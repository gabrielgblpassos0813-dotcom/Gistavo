from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
import secrets
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBasic()

# ==================== MULTI-TENANT SYSTEM ====================
# Maximum 2 accounts allowed
MAX_ACCOUNTS = 2

class TenantCreate(BaseModel):
    username: str
    password: str
    display_name: str = ""

class TenantLogin(BaseModel):
    username: str
    password: str

class TenantResponse(BaseModel):
    id: str
    username: str
    display_name: str
    created_at: str

async def get_tenant_by_credentials(username: str, password: str):
    """Get tenant by username and password"""
    import hashlib
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    tenant = await db.tenants.find_one({
        "username": username,
        "password_hash": password_hash
    })
    return tenant

async def get_tenant_by_id(tenant_id: str):
    """Get tenant by ID"""
    return await db.tenants.find_one({"id": tenant_id})

async def ensure_default_tenant():
    """Create default Gestor tenant if it doesn't exist"""
    import hashlib
    existing = await db.tenants.find_one({"username": "gestor"})
    if not existing:
        password_hash = hashlib.sha256("ganoh2024".encode()).hexdigest()
        await db.tenants.insert_one({
            "id": "tenant_gestor",
            "username": "gestor",
            "password_hash": password_hash,
            "display_name": "GANOH Café Bistrô",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_default": True
        })
        logging.info("Default tenant 'gestor' created")

# Legacy support - will be replaced by tenant system
GESTOR_USERNAME = os.environ.get('GESTOR_USERNAME', 'gestor')
GESTOR_PASSWORD = os.environ.get('GESTOR_PASSWORD', 'ganoh2024')

def verify_gestor(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, GESTOR_USERNAME)
    correct_password = secrets.compare_digest(credentials.password, GESTOR_PASSWORD)
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=401,
            detail="Credenciais inválidas",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

# Enums
class OrderStatus(str, Enum):
    PENDING_PAYMENT = "pending_payment"  # Waiting for PIX proof
    PAYMENT_REJECTED = "payment_rejected"  # PIX rejected
    RECEIVED = "received"
    PREPARING = "preparing"
    READY = "ready"
    DELIVERED = "delivered"

class PaymentMethod(str, Enum):
    PIX = "pix"
    DEBIT = "debit"
    CREDIT = "credit"
    CASH = "cash"
    PRAZO = "prazo"  # Credit/Tab - pay later

# PIX Configuration (same for both stores)
PIX_CONFIG = {
    "key": "",  # Will be set by store owner
    "key_type": "cpf",  # cpf, cnpj, email, phone, random
    "beneficiary_name": "GANOH Café Bistrô",
    "city": "São Paulo"
}

class StoreLocation(str, Enum):
    RUNNER = "runner"
    GYM_LONDRES = "gym-londres"

# Models
class MenuItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float
    category: str
    prep_time: int = 15
    available: bool = True

class StockItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    menu_item_id: str
    store: StoreLocation
    quantity: int = 0
    min_quantity: int = 5  # Alert when below this
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StockUpdate(BaseModel):
    quantity: int

class OrderItem(BaseModel):
    menu_item_id: str
    name: str
    price: float
    quantity: int

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store: StoreLocation
    customer_name: str
    items: List[OrderItem]
    total: float
    payment_method: PaymentMethod
    status: OrderStatus = OrderStatus.RECEIVED
    prep_time: int = 15
    pickup_time: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    synced: bool = True  # For offline support

class OrderCreate(BaseModel):
    store: StoreLocation
    customer_name: str
    items: List[OrderItem]
    total: float
    payment_method: PaymentMethod
    pickup_time: Optional[str] = None
    offline_id: Optional[str] = None  # For offline sync
    pix_proof: Optional[str] = None  # Base64 image of PIX proof

class OrderStatusUpdate(BaseModel):
    status: OrderStatus

class PixProofUpload(BaseModel):
    proof_image: str  # Base64 encoded image

class PaymentApproval(BaseModel):
    approved: bool
    rejection_reason: Optional[str] = None

class SalesReport(BaseModel):
    total_sales: float
    order_count: int
    by_payment_method: dict
    top_products: List[dict]
    low_products: List[dict]

# Menu Data - GANOH Café Bistrô (same for both stores)
MENU_DATA = [
    # Omeletes, Tapiocas e Crepiocas
    {"id": "1", "name": "Frango com Requeijão", "description": "Omelete/Tapioca com frango desfiado e requeijão cremoso", "price": 25.50, "category": "Omeletes, Tapiocas e Crepiocas", "prep_time": 15},
    {"id": "2", "name": "Frango, Mussarela, Tomate e Orégano", "description": "Combinação clássica com frango, queijo mussarela, tomate fresco e orégano", "price": 26.00, "category": "Omeletes, Tapiocas e Crepiocas", "prep_time": 15},
    {"id": "3", "name": "Queijo Branco, Tomate e Orégano", "description": "Opção leve com queijo branco, tomate e orégano", "price": 23.50, "category": "Omeletes, Tapiocas e Crepiocas", "prep_time": 15},
    {"id": "4", "name": "Queijo Branco, Peito de Peru e Orégano", "description": "Queijo branco com peito de peru e orégano", "price": 24.00, "category": "Omeletes, Tapiocas e Crepiocas", "prep_time": 15},
    {"id": "5", "name": "Mussarela, Peito de Peru, Tomate e Orégano", "description": "Mussarela derretida com peito de peru, tomate e orégano", "price": 23.50, "category": "Omeletes, Tapiocas e Crepiocas", "prep_time": 15},
    {"id": "6", "name": "Atum com Requeijão", "description": "Atum em lascas com requeijão cremoso", "price": 26.50, "category": "Omeletes, Tapiocas e Crepiocas", "prep_time": 15},
    {"id": "7", "name": "Atum, Mussarela e Tomate", "description": "Atum com mussarela e tomate fresco", "price": 26.50, "category": "Omeletes, Tapiocas e Crepiocas", "prep_time": 15},
    {"id": "8", "name": "Especial", "description": "Frango, mussarela, peito de peru, tomate e orégano - nossa combinação mais completa", "price": 27.50, "category": "Omeletes, Tapiocas e Crepiocas", "prep_time": 15},
    
    # Brunchs
    {"id": "9", "name": "Saudável", "description": "3 ovos mexidos, pão integral, café, fruta (mamão ou banana), aveia e mel", "price": 21.00, "category": "Brunchs", "prep_time": 15},
    {"id": "10", "name": "Café Egg", "description": "2 ovos mexidos, café pequeno e pão integral", "price": 19.00, "category": "Brunchs", "prep_time": 15},
    {"id": "11", "name": "Mineirinho", "description": "2 ovos fritos, queijo minas, duas fatias de pão integral e café com leite", "price": 23.00, "category": "Brunchs", "prep_time": 15},
    {"id": "12", "name": "Honey", "description": "2 ovos mexidos, banana, granola e mel", "price": 18.00, "category": "Brunchs", "prep_time": 15},
    {"id": "13", "name": "Banana Bliss", "description": "Banana, aveia, canela e mel", "price": 10.00, "category": "Brunchs", "prep_time": 15},
    {"id": "14", "name": "Banana Power", "description": "Banana, proteína, aveia, canela e mel", "price": 15.00, "category": "Brunchs", "prep_time": 15},
    {"id": "15", "name": "Pão de Queijo", "description": "Tradicional pão de queijo mineiro quentinho", "price": 8.00, "category": "Brunchs", "prep_time": 15},
    {"id": "16", "name": "Salgado", "description": "Salgado assado do dia", "price": 9.00, "category": "Brunchs", "prep_time": 15},
    
    # Toasts
    {"id": "17", "name": "Pão com Ovos", "description": "Pão integral, requeijão, ovos, mussarela e tomate", "price": 15.00, "category": "Toasts", "prep_time": 15},
    {"id": "18", "name": "Queijo Quente", "description": "Pão integral, mussarela, orégano e tomate", "price": 14.00, "category": "Toasts", "prep_time": 15},
    {"id": "19", "name": "Peito de Peru", "description": "Requeijão, peito de peru, mussarela, tomate e orégano", "price": 15.00, "category": "Toasts", "prep_time": 15},
    {"id": "20", "name": "Queijo Branco", "description": "Requeijão, queijo branco, tomate e orégano", "price": 16.00, "category": "Toasts", "prep_time": 15},
    {"id": "21", "name": "Queijo Branco e Peito de Peru", "description": "Requeijão, peito de peru, queijo branco, tomate e orégano", "price": 17.00, "category": "Toasts", "prep_time": 15},
    {"id": "22", "name": "Proteico Frango", "description": "Requeijão, frango, mussarela, tomate e orégano", "price": 18.00, "category": "Toasts", "prep_time": 15},
    {"id": "23", "name": "Proteico Atum", "description": "Requeijão, atum, mussarela, tomate e orégano", "price": 19.00, "category": "Toasts", "prep_time": 15},
    
    # Shakes Proteicos
    {"id": "24", "name": "Whey Morango com Água e Banana", "description": "Shake de whey sabor morango com água e banana", "price": 19.00, "category": "Shakes Proteicos", "prep_time": 15},
    {"id": "25", "name": "Whey Baunilha, Água, Mamão e Aveia", "description": "Shake de whey baunilha com mamão e aveia", "price": 23.00, "category": "Shakes Proteicos", "prep_time": 15},
    {"id": "26", "name": "Whey Baunilha, Água, Abacaxi e Mel", "description": "Shake de whey baunilha com abacaxi e mel", "price": 23.00, "category": "Shakes Proteicos", "prep_time": 15},
    {"id": "27", "name": "Whey Chocolate, Água, Banana e Paçoca", "description": "Shake de whey chocolate com banana e paçoca", "price": 22.00, "category": "Shakes Proteicos", "prep_time": 15},
    {"id": "28", "name": "Whey Morango, Leite e Banana", "description": "Shake cremoso de whey morango com leite e banana", "price": 22.00, "category": "Shakes Proteicos", "prep_time": 15},
    {"id": "29", "name": "Whey Baunilha, Leite, Banana e Mamão", "description": "Shake de whey baunilha com leite, banana e mamão", "price": 24.00, "category": "Shakes Proteicos", "prep_time": 15},
    {"id": "30", "name": "Whey Chocolate, Leite e Morango", "description": "Shake de whey chocolate com leite e morango", "price": 22.00, "category": "Shakes Proteicos", "prep_time": 15},
    {"id": "31", "name": "Whey Baunilha, Açaí, Morango e Banana", "description": "Shake especial com açaí, morango e banana", "price": 26.00, "category": "Shakes Proteicos", "prep_time": 15},
    
    # Açaí
    {"id": "32", "name": "Açaí Batido com Água", "description": "Açaí puro batido com água", "price": 16.00, "category": "Açaí", "prep_time": 15},
    {"id": "33", "name": "Açaí Batido com Leite", "description": "Açaí cremoso batido com leite", "price": 18.00, "category": "Açaí", "prep_time": 15},
    {"id": "34", "name": "Açaí Batido com Laranja", "description": "Açaí refrescante batido com suco de laranja", "price": 19.00, "category": "Açaí", "prep_time": 15},
    {"id": "35", "name": "Açaí Batido com Leite, Banana e Morango", "description": "Açaí cremoso com leite, banana e morango", "price": 21.00, "category": "Açaí", "prep_time": 15},
    {"id": "36", "name": "Açaí na Tigela 500ml", "description": "1 fruta + 3 adicionais (aveia, mel, granola, leite em pó ou leite condensado)", "price": 22.00, "category": "Açaí", "prep_time": 15},
    
    # Sucos e Vitaminas
    {"id": "37", "name": "Suco Natural de Laranja", "description": "Suco de laranja 100% natural", "price": 15.00, "category": "Sucos e Vitaminas", "prep_time": 15},
    {"id": "38", "name": "Suco Natural de Abacaxi", "description": "Suco de abacaxi fresco", "price": 14.00, "category": "Sucos e Vitaminas", "prep_time": 15},
    {"id": "39", "name": "Suco Natural de Manga", "description": "Suco de manga natural", "price": 14.00, "category": "Sucos e Vitaminas", "prep_time": 15},
    {"id": "40", "name": "Suco Natural de Morango e Laranja", "description": "Mix refrescante de morango com laranja", "price": 16.00, "category": "Sucos e Vitaminas", "prep_time": 15},
    {"id": "41", "name": "Suco Natural de Maracujá com Manga", "description": "Combinação tropical de maracujá com manga", "price": 16.00, "category": "Sucos e Vitaminas", "prep_time": 15},
    {"id": "42", "name": "Suco Detox", "description": "Abacaxi, hortelã, couve, gengibre e maçã", "price": 15.00, "category": "Sucos e Vitaminas", "prep_time": 15},
    {"id": "43", "name": "Vitamina com Uma Fruta", "description": "Vitamina cremosa com a fruta de sua escolha", "price": 15.00, "category": "Sucos e Vitaminas", "prep_time": 15},
    {"id": "44", "name": "Vitamina com Duas Frutas", "description": "Vitamina cremosa com duas frutas de sua escolha", "price": 18.00, "category": "Sucos e Vitaminas", "prep_time": 15},
    
    # Saladas
    {"id": "45", "name": "Salada de Frutas", "description": "Mix de frutas frescas do dia", "price": 14.00, "category": "Saladas", "prep_time": 15},
    {"id": "46", "name": "Salada Simples", "description": "Alface, tomate e cenoura - acompanhamento perfeito", "price": 7.00, "category": "Saladas", "prep_time": 15},
    {"id": "47", "name": "Salada Ganoh", "description": "Alface, tomate, cenoura, queijo branco, frango ou atum, molho da casa e torradinhas", "price": 19.00, "category": "Saladas", "prep_time": 15},
    
    # Bebidas Quentes
    {"id": "48", "name": "Café Pequeno", "description": "Café coado tradicional", "price": 4.50, "category": "Bebidas Quentes", "prep_time": 15},
    {"id": "49", "name": "Café Grande", "description": "Café coado em porção generosa", "price": 6.00, "category": "Bebidas Quentes", "prep_time": 15},
    {"id": "50", "name": "Café com Leite", "description": "Café coado com leite vaporizado", "price": 7.00, "category": "Bebidas Quentes", "prep_time": 15},
    {"id": "51", "name": "Expresso", "description": "Café expresso encorpado", "price": 8.00, "category": "Bebidas Quentes", "prep_time": 15},
    {"id": "52", "name": "Chá", "description": "Chá quente - consulte sabores disponíveis", "price": 6.00, "category": "Bebidas Quentes", "prep_time": 15},
    {"id": "53", "name": "Capuccino / Mocaccino", "description": "Bebida cremosa com espuma de leite", "price": 9.00, "category": "Bebidas Quentes", "prep_time": 15},
    {"id": "54", "name": "Chocolate Quente", "description": "Chocolate cremoso e reconfortante", "price": 9.00, "category": "Bebidas Quentes", "prep_time": 15},
    
    # Bebidas Geladas
    {"id": "55", "name": "Água Pequena", "description": "Água mineral 300ml", "price": 5.00, "category": "Bebidas Geladas", "prep_time": 15},
    {"id": "56", "name": "Água Grande", "description": "Água mineral 500ml", "price": 8.00, "category": "Bebidas Geladas", "prep_time": 15},
    {"id": "57", "name": "H2O", "description": "Água saborizada", "price": 8.00, "category": "Bebidas Geladas", "prep_time": 15},
    {"id": "58", "name": "Gatorade", "description": "Isotônico para reposição", "price": 9.00, "category": "Bebidas Geladas", "prep_time": 15},
    {"id": "59", "name": "Energético Red Bull", "description": "Bebida energética", "price": 15.00, "category": "Bebidas Geladas", "prep_time": 15},
    {"id": "60", "name": "Energético Monster", "description": "Bebida energética", "price": 15.00, "category": "Bebidas Geladas", "prep_time": 15},
    {"id": "61", "name": "Mupy", "description": "Bebida láctea infantil", "price": 6.00, "category": "Bebidas Geladas", "prep_time": 15},
    {"id": "62", "name": "Kapo", "description": "Suco de caixinha", "price": 6.00, "category": "Bebidas Geladas", "prep_time": 15},
    {"id": "63", "name": "Toddynho", "description": "Achocolatado", "price": 6.00, "category": "Bebidas Geladas", "prep_time": 15},
    {"id": "64", "name": "Água de Coco Grande", "description": "Água de coco natural 500ml", "price": 8.00, "category": "Bebidas Geladas", "prep_time": 15},
    {"id": "65", "name": "Água de Coco Pequena", "description": "Água de coco natural 300ml", "price": 6.00, "category": "Bebidas Geladas", "prep_time": 15},
    {"id": "66", "name": "Coca-Cola Mini", "description": "Coca-Cola 200ml", "price": 3.50, "category": "Bebidas Geladas", "prep_time": 15},
    {"id": "67", "name": "Coca-Cola Lata", "description": "Coca-Cola 350ml", "price": 6.60, "category": "Bebidas Geladas", "prep_time": 15},
    
    # Suplementos
    {"id": "68", "name": "Creatina (1 dose)", "description": "Dose de creatina monohidratada", "price": 8.00, "category": "Suplementos", "prep_time": 15},
    {"id": "69", "name": "Pré Treino (1 dose)", "description": "Dose de pré-treino para energia", "price": 9.00, "category": "Suplementos", "prep_time": 15},
    {"id": "70", "name": "Dose de Whey (2 scoops)", "description": "Proteína whey isolada", "price": 13.00, "category": "Suplementos", "prep_time": 15},
    {"id": "71", "name": "Carb Up", "description": "Carboidrato de rápida absorção", "price": 9.00, "category": "Suplementos", "prep_time": 15},
]

CATEGORIES = [
    "Omeletes, Tapiocas e Crepiocas",
    "Brunchs",
    "Toasts",
    "Shakes Proteicos",
    "Açaí",
    "Sucos e Vitaminas",
    "Saladas",
    "Bebidas Quentes",
    "Bebidas Geladas",
    "Suplementos",
    "Doces"
]

ADICIONAIS = [
    {"id": "72", "name": "Ovos", "price": 3.50},
    {"id": "73", "name": "Atum", "price": 7.00},
    {"id": "74", "name": "Queijo Branco", "price": 8.00},
    {"id": "75", "name": "Mussarela", "price": 3.00},
    {"id": "76", "name": "Frango", "price": 7.00},
    {"id": "77", "name": "Mel", "price": 3.50},
    {"id": "78", "name": "Granola", "price": 3.50},
    {"id": "79", "name": "Nutella", "price": 5.00},
]

STORES = {
    "runner": {"name": "GANOH Café Bistrô - Runner", "address": "Runner"},
    "gym-londres": {"name": "GANOH Café Bistrô - GYM Londres", "address": "GYM Londres"}
}

# ==================== MENU ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "GANOH Café Bistrô API"}

# ==================== TENANT AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register_tenant(tenant: TenantCreate):
    """Register a new tenant account (max 2 accounts)"""
    import hashlib
    
    # Check max accounts
    count = await db.tenants.count_documents({})
    if count >= MAX_ACCOUNTS:
        raise HTTPException(status_code=400, detail=f"Limite máximo de {MAX_ACCOUNTS} contas atingido")
    
    # Check if username exists
    existing = await db.tenants.find_one({"username": tenant.username.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Nome de usuário já existe")
    
    # Create tenant
    password_hash = hashlib.sha256(tenant.password.encode()).hexdigest()
    tenant_id = f"tenant_{str(uuid.uuid4())[:8]}"
    
    await db.tenants.insert_one({
        "id": tenant_id,
        "username": tenant.username.lower(),
        "password_hash": password_hash,
        "display_name": tenant.display_name or tenant.username,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_default": False
    })
    
    return {
        "success": True,
        "tenant_id": tenant_id,
        "username": tenant.username.lower(),
        "message": "Conta criada com sucesso!"
    }

@api_router.post("/auth/login")
async def login_tenant(credentials: TenantLogin):
    """Login with tenant credentials"""
    tenant = await get_tenant_by_credentials(credentials.username.lower(), credentials.password)
    if not tenant:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    return {
        "success": True,
        "tenant_id": tenant["id"],
        "username": tenant["username"],
        "display_name": tenant.get("display_name", tenant["username"]),
        "message": "Login realizado com sucesso!"
    }

@api_router.get("/auth/accounts")
async def list_accounts():
    """List all tenant accounts (for display purposes)"""
    tenants = await db.tenants.find({}, {"_id": 0, "password_hash": 0}).to_list(10)
    count = len(tenants)
    return {
        "accounts": tenants,
        "count": count,
        "max_accounts": MAX_ACCOUNTS,
        "can_create": count < MAX_ACCOUNTS
    }

@api_router.get("/auth/check/{tenant_id}")
async def check_tenant(tenant_id: str):
    """Check if tenant exists"""
    tenant = await get_tenant_by_id(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    return {
        "exists": True,
        "username": tenant["username"],
        "display_name": tenant.get("display_name", tenant["username"])
    }

@api_router.get("/stores")
async def get_stores():
    return {"stores": STORES}

@api_router.get("/categories")
async def get_categories():
    """Return all menu categories"""
    return {"categories": CATEGORIES}

@api_router.get("/menu/{store}")
async def get_menu(store: StoreLocation):
    # Get stock for bebidas only (other items don't need stock control)
    stock_docs = await db.stock.find({"store": store.value}, {"_id": 0}).to_list(1000)
    stock_map = {s["menu_item_id"]: s["quantity"] for s in stock_docs}
    
    # Get custom menu items added by gestor for this store
    custom_items = await db.menu.find({
        "$or": [
            {"store": store.value},
            {"store": "all"},
            {"store": {"$exists": False}}  # Items without store filter apply to all
        ]
    }, {"_id": 0}).to_list(1000)
    
    # Add availability based on stock (only for bebidas)
    items_with_stock = []
    seen_ids = set()
    
    # First add default menu items
    for item in MENU_DATA:
        item_copy = item.copy()
        if item["category"] in STOCK_CATEGORIES:
            stock_qty = stock_map.get(item["id"], 0)
            item_copy["stock"] = stock_qty
            item_copy["available"] = stock_qty > 0
        else:
            # Non-beverage items are always available
            item_copy["stock"] = None
            item_copy["available"] = True
        items_with_stock.append(item_copy)
        seen_ids.add(item["id"])
    
    # Then add custom items from gestor (avoid duplicates)
    for custom_item in custom_items:
        if custom_item.get("id") not in seen_ids:
            item_copy = custom_item.copy()
            # Check if this category needs stock control
            if custom_item.get("category") in STOCK_CATEGORIES:
                stock_qty = stock_map.get(custom_item.get("id"), 0)
                item_copy["stock"] = stock_qty
                item_copy["available"] = stock_qty > 0
            else:
                item_copy["stock"] = None
                item_copy["available"] = True
            items_with_stock.append(item_copy)
            seen_ids.add(custom_item.get("id"))
    
    # Get all unique categories (default + custom)
    all_categories = list(CATEGORIES)
    for custom_item in custom_items:
        cat = custom_item.get("category")
        if cat and cat not in all_categories:
            all_categories.append(cat)
    
    return {
        "items": items_with_stock, 
        "categories": all_categories, 
        "adicionais": ADICIONAIS,
        "store": STORES.get(store.value)
    }

@api_router.get("/categories")
async def get_categories():
    return {"categories": CATEGORIES}

# ==================== ORDER ROUTES ====================

@api_router.post("/orders")
async def create_order(order_input: OrderCreate):
    # Check stock availability
    for item in order_input.items:
        stock = await db.stock.find_one({
            "menu_item_id": item.menu_item_id.split("-")[0],  # Handle adicionais
            "store": order_input.store.value
        })
        if stock and stock.get("quantity", 0) < item.quantity:
            raise HTTPException(
                status_code=400, 
                detail=f"Estoque insuficiente para {item.name}"
            )
    
    # Determine initial status based on payment method
    initial_status = OrderStatus.PENDING_PAYMENT if order_input.payment_method == PaymentMethod.PIX else OrderStatus.RECEIVED
    
    order = Order(
        store=order_input.store,
        customer_name=order_input.customer_name,
        items=order_input.items,
        total=order_input.total,
        payment_method=order_input.payment_method,
        status=initial_status,
        prep_time=15,
        pickup_time=order_input.pickup_time
    )
    
    doc = order.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    doc['store'] = doc['store'].value
    doc['payment_method'] = doc['payment_method'].value
    doc['status'] = doc['status'].value
    
    # Add PIX proof if provided
    if order_input.pix_proof:
        doc['pix_proof'] = order_input.pix_proof
    
    await db.orders.insert_one(doc)
    
    # Update stock (only for non-PIX or after PIX approval)
    if order_input.payment_method != PaymentMethod.PIX:
        for item in order_input.items:
            await db.stock.update_one(
                {"menu_item_id": item.menu_item_id.split("-")[0], "store": order_input.store.value},
                {"$inc": {"quantity": -item.quantity}},
                upsert=False
            )
    
    return {**doc, "_id": None}

@api_router.post("/orders/sync")
async def sync_offline_orders(orders: List[OrderCreate]):
    """Sync offline orders when connection is restored"""
    synced = []
    for order_input in orders:
        try:
            result = await create_order(order_input)
            synced.append({"offline_id": order_input.offline_id, "synced": True, "order": result})
        except Exception as e:
            synced.append({"offline_id": order_input.offline_id, "synced": False, "error": str(e)})
    return {"synced_orders": synced}

@api_router.get("/orders/{store}")
async def get_orders(store: StoreLocation, status: Optional[str] = None):
    query = {"store": store.value}
    if status:
        query["status"] = status
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"orders": orders}

@api_router.get("/orders/{store}/pending-pix")
async def get_pending_pix_orders(store: StoreLocation):
    """Get orders pending PIX approval"""
    orders = await db.orders.find({
        "store": store.value,
        "payment_method": "pix",
        "status": "pending_payment",
        "pix_proof": {"$exists": True}
    }, {"_id": 0}).sort("created_at", 1).to_list(100)
    return {"orders": orders}

@api_router.get("/orders/{store}/history")
async def get_order_history(store: StoreLocation):
    """Get ready and delivered orders from the last 24 hours"""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    
    # Get from order_history (delivered orders)
    history_orders = await db.order_history.find({
        "store": store.value,
        "delivered_at": {"$gte": cutoff.isoformat()}
    }, {"_id": 0}).sort("delivered_at", -1).to_list(500)
    
    # Get ready orders from main orders collection
    ready_orders = await db.orders.find({
        "store": store.value,
        "status": "ready",
        "created_at": {"$gte": cutoff.isoformat()}
    }, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Combine and sort by most recent
    all_orders = history_orders + ready_orders
    all_orders.sort(key=lambda x: x.get('delivered_at', x.get('updated_at', x.get('created_at', ''))), reverse=True)
    
    return {"orders": all_orders, "count": len(all_orders)}

@api_router.get("/orders/{store}/{order_id}")
async def get_order(store: StoreLocation, order_id: str):
    order = await db.orders.find_one({"id": order_id, "store": store.value}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return order

@api_router.patch("/orders/{store}/{order_id}/status")
async def update_order_status(store: StoreLocation, order_id: str, status_update: OrderStatusUpdate):
    # Get current order
    order = await db.orders.find_one({"id": order_id, "store": store.value})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    # If moving to delivered, save to history
    if status_update.status == OrderStatus.DELIVERED:
        order_copy = {k: v for k, v in order.items() if k != '_id'}
        order_copy['status'] = 'delivered'
        order_copy['delivered_at'] = datetime.now(timezone.utc).isoformat()
        await db.order_history.insert_one(order_copy)
    
    await db.orders.update_one(
        {"id": order_id, "store": store.value},
        {"$set": {"status": status_update.status.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return order

# ==================== PIX PAYMENT ROUTES ====================

@api_router.get("/pix/config")
async def get_pix_config():
    """Get PIX configuration for QR code generation"""
    return {
        "key": PIX_CONFIG["key"],
        "key_type": PIX_CONFIG["key_type"],
        "beneficiary_name": PIX_CONFIG["beneficiary_name"],
        "city": PIX_CONFIG["city"],
        "has_key": bool(PIX_CONFIG["key"])
    }

@api_router.post("/orders/{store}/{order_id}/pix-proof")
async def upload_pix_proof(store: StoreLocation, order_id: str, proof: PixProofUpload):
    """Upload PIX payment proof and auto-verify with AI"""
    order = await db.orders.find_one({"id": order_id, "store": store.value})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    if order.get("payment_method") != "pix":
        raise HTTPException(status_code=400, detail="Este pedido não é PIX")
    
    await db.orders.update_one(
        {"id": order_id, "store": store.value},
        {
            "$set": {
                "pix_proof": proof.proof_image,
                "pix_proof_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Auto-verify the PIX proof with AI in the background
    import asyncio
    asyncio.create_task(auto_verify_pix_background(store, order_id, proof.proof_image, order.get("total", 0)))
    
    return {"success": True, "message": "Comprovante enviado! Verificando automaticamente..."}

async def auto_verify_pix_background(store: StoreLocation, order_id: str, pix_proof: str, expected_amount: float):
    """Background task to auto-verify PIX proof with AI"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        # Extract base64 from data URL if present
        image_base64 = pix_proof
        if pix_proof.startswith("data:"):
            image_base64 = pix_proof.split(",")[1]
        
        system_prompt = f"""Você é um assistente de OCR especializado em extrair texto de recibos de transação PIX.
Sua função é apenas ler e extrair informações textuais de comprovantes.

O valor esperado do pagamento é R$ {expected_amount:.2f}.
O destinatário esperado deve conter "saudavelmente" ou "ganoh" ou "49289019000199".

Responda APENAS em formato JSON:
{{
    "payer_name": "nome do remetente/pagador encontrado na imagem",
    "amount": valor numérico encontrado (float),
    "recipient": "nome do destinatário/beneficiário encontrado",
    "transaction_time": "horário da transação encontrado (formato HH:MM)",
    "transaction_date": "data da transação (formato DD/MM/YYYY)",
    "is_valid": true se valor >= {expected_amount:.2f} e destinatário está correto, false caso contrário,
    "reason": "motivo da validação"
}}"""
        
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=f"pix-verify-{order_id}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")
        
        image_content = ImageContent(image_base64=image_base64)
        user_message = UserMessage(
            text="Por favor, extraia as informações deste recibo de transação PIX.",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        
        # Parse AI response
        import json
        import re
        
        response_text = response
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            analysis = json.loads(json_match.group())
        else:
            analysis = {"is_valid": False, "reason": "Não foi possível analisar o comprovante"}
        
        payer_name = analysis.get("payer_name", "Desconhecido")
        extracted_amount = analysis.get("amount", 0)
        transaction_time = analysis.get("transaction_time", datetime.now().strftime("%H:%M"))
        transaction_date = analysis.get("transaction_date", datetime.now().strftime("%d/%m/%Y"))
        is_valid = analysis.get("is_valid", False)
        
        # Save analysis to order
        await db.orders.update_one(
            {"id": order_id, "store": store.value},
            {
                "$set": {
                    "pix_analysis": analysis,
                    "pix_payer_name": payer_name,
                    "pix_extracted_amount": extracted_amount,
                    "pix_transaction_time": transaction_time,
                    "pix_transaction_date": transaction_date,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        if is_valid:
            # Get order for stock update
            order = await db.orders.find_one({"id": order_id, "store": store.value})
            
            # Update stock
            for item in order.get("items", []):
                await db.stock.update_one(
                    {"menu_item_id": item["menu_item_id"].split("-")[0], "store": store.value},
                    {"$inc": {"quantity": -item["quantity"]}},
                    upsert=False
                )
            
            # Update order status - AUTO APPROVED!
            await db.orders.update_one(
                {"id": order_id, "store": store.value},
                {
                    "$set": {
                        "status": "received",
                        "payment_approved_at": datetime.now(timezone.utc).isoformat(),
                        "auto_approved": True,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            # Send WhatsApp notification WITH image
            try:
                async with httpx.AsyncClient() as client_http:
                    await client_http.post(
                        "http://localhost:8002/send-notification",
                        json={
                            "customerName": order.get("customer_name", "Cliente"),
                            "payerName": payer_name,
                            "amount": order.get("total", 0),
                            "store": store.value,
                            "time": transaction_time,
                            "date": transaction_date,
                            "orderNumber": order.get("order_number", order_id[:8]),
                            "items": order.get("items", []),
                            "proofImage": pix_proof,
                            "autoApproved": True
                        },
                        timeout=10.0
                    )
            except Exception as e:
                logger.warning(f"Could not send WhatsApp notification: {e}")
            
            logger.info(f"PIX auto-approved for order {order_id}")
        else:
            logger.info(f"PIX verification failed for order {order_id}: {analysis.get('reason')}")
            
    except Exception as e:
        logger.error(f"Error in background PIX verification: {e}")

@api_router.post("/orders/{store}/{order_id}/auto-verify-pix")
async def auto_verify_pix_payment(store: StoreLocation, order_id: str):
    """Use AI to analyze PIX proof and auto-approve if valid"""
    order = await db.orders.find_one({"id": order_id, "store": store.value})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    if order.get("status") != "pending_payment":
        raise HTTPException(status_code=400, detail="Pedido não está aguardando aprovação")
    
    pix_proof = order.get("pix_proof")
    if not pix_proof:
        raise HTTPException(status_code=400, detail="Comprovante PIX não encontrado")
    
    expected_amount = order.get("total", 0)
    
    # Analyze the PIX proof with AI
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        # Extract base64 from data URL if present
        image_base64 = pix_proof
        if pix_proof.startswith("data:"):
            image_base64 = pix_proof.split(",")[1]
        
        system_prompt = f"""Você é um assistente de OCR especializado em extrair texto de recibos de transação PIX.
Sua função é apenas ler e extrair informações textuais de comprovantes.

O valor esperado do pagamento é R$ {expected_amount:.2f}.
O destinatário esperado deve conter "saudavelmente" ou "ganoh" ou "49289019000199".

Responda APENAS em formato JSON:
{{
    "payer_name": "nome do remetente/pagador encontrado na imagem",
    "amount": valor numérico encontrado (float),
    "recipient": "nome do destinatário/beneficiário encontrado",
    "is_valid": true se valor >= {expected_amount:.2f} e destinatário está correto, false caso contrário,
    "reason": "motivo da validação"
}}"""
        
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=f"pix-verify-{order_id}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")
        
        image_content = ImageContent(image_base64=image_base64)
        user_message = UserMessage(
            text="Por favor, extraia as informações deste recibo de transação PIX.",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        
        # Parse AI response
        import json
        import re
        
        response_text = response  # send_message returns string directly
        # Extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            analysis = json.loads(json_match.group())
        else:
            analysis = {"is_valid": False, "reason": "Não foi possível analisar o comprovante"}
        
        payer_name = analysis.get("payer_name", "Desconhecido")
        extracted_amount = analysis.get("amount", 0)
        transaction_time = analysis.get("transaction_time", datetime.now().strftime("%H:%M"))
        transaction_date = analysis.get("transaction_date", datetime.now().strftime("%d/%m/%Y"))
        is_valid = analysis.get("is_valid", False)
        
        # Save analysis to order
        await db.orders.update_one(
            {"id": order_id, "store": store.value},
            {
                "$set": {
                    "pix_analysis": analysis,
                    "pix_payer_name": payer_name,
                    "pix_extracted_amount": extracted_amount,
                    "pix_transaction_time": transaction_time,
                    "pix_transaction_date": transaction_date,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        if is_valid:
            # Auto-approve the payment
            # Update stock
            for item in order.get("items", []):
                await db.stock.update_one(
                    {"menu_item_id": item["menu_item_id"].split("-")[0], "store": store.value},
                    {"$inc": {"quantity": -item["quantity"]}},
                    upsert=False
                )
            
            # Update order status
            await db.orders.update_one(
                {"id": order_id, "store": store.value},
                {
                    "$set": {
                        "status": "received",
                        "payment_approved_at": datetime.now(timezone.utc).isoformat(),
                        "auto_approved": True,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            # Send WhatsApp notification WITH image
            try:
                async with httpx.AsyncClient() as client_http:
                    await client_http.post(
                        "http://localhost:8002/send-notification",
                        json={
                            "customerName": order.get("customer_name", "Cliente"),
                            "payerName": payer_name,
                            "amount": order.get("total", 0),
                            "store": store.value,
                            "time": transaction_time,
                            "date": transaction_date,
                            "orderNumber": order.get("order_number", order_id[:8]),
                            "items": order.get("items", []),
                            "proofImage": pix_proof,
                            "autoApproved": True
                        },
                        timeout=10.0
                    )
            except Exception as e:
                logger.warning(f"Could not send WhatsApp notification: {e}")
            
            return {
                "success": True,
                "auto_approved": True,
                "payer_name": payer_name,
                "extracted_amount": extracted_amount,
                "analysis": analysis,
                "message": "Pagamento verificado e aprovado automaticamente!"
            }
        else:
            return {
                "success": True,
                "auto_approved": False,
                "payer_name": payer_name,
                "extracted_amount": extracted_amount,
                "analysis": analysis,
                "message": f"Verificação falhou: {analysis.get('reason', 'Dados não correspondem')}"
            }
            
    except Exception as e:
        logger.error(f"Error analyzing PIX proof: {e}")
        return {
            "success": False,
            "auto_approved": False,
            "error": str(e),
            "message": "Erro ao analisar comprovante. Aprovação manual necessária."
        }

@api_router.post("/orders/{store}/{order_id}/approve-payment")
async def approve_or_reject_payment(store: StoreLocation, order_id: str, approval: PaymentApproval):
    """Approve or reject PIX payment"""
    order = await db.orders.find_one({"id": order_id, "store": store.value})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    if order.get("status") != "pending_payment":
        raise HTTPException(status_code=400, detail="Pedido não está aguardando aprovação")
    
    if approval.approved:
        # Update stock on approval
        for item in order.get("items", []):
            await db.stock.update_one(
                {"menu_item_id": item["menu_item_id"].split("-")[0], "store": store.value},
                {"$inc": {"quantity": -item["quantity"]}},
                upsert=False
            )
        
        await db.orders.update_one(
            {"id": order_id, "store": store.value},
            {
                "$set": {
                    "status": "received",
                    "payment_approved_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Send WhatsApp notification WITH proof image
        try:
            pix_proof = order.get("pix_proof")
            payer_name = order.get("pix_payer_name", order.get("customer_name", "Cliente"))
            
            async with httpx.AsyncClient() as client_http:
                await client_http.post(
                    "http://localhost:8002/send-notification",
                    json={
                        "customerName": order.get("customer_name", "Cliente"),
                        "payerName": payer_name,
                        "amount": order.get("total", 0),
                        "store": store.value,
                        "time": datetime.now().strftime("%H:%M"),
                        "orderNumber": order.get("order_number", order_id[:8]),
                        "items": order.get("items", []),
                        "proofImage": pix_proof,
                        "autoApproved": False
                    },
                    timeout=10.0
                )
        except Exception as e:
            logger.warning(f"Could not send WhatsApp notification: {e}")
        
        return {"success": True, "message": "Pagamento aprovado", "new_status": "received"}
    else:
        await db.orders.update_one(
            {"id": order_id, "store": store.value},
            {
                "$set": {
                    "status": "payment_rejected",
                    "rejection_reason": approval.rejection_reason,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        return {"success": True, "message": "Pagamento rejeitado", "new_status": "payment_rejected"}

@api_router.delete("/orders/history/cleanup")
async def cleanup_old_history():
    """Clean up order history older than 24 hours (can be called by cron)"""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    result = await db.order_history.delete_many({
        "delivered_at": {"$lt": cutoff.isoformat()}
    })
    return {"deleted": result.deleted_count}

# ==================== STOCK ROUTES ====================

# Categorias que precisam de controle de estoque
STOCK_CATEGORIES = ["Bebidas Quentes", "Bebidas Geladas"]

# Ingredientes para estoque
INGREDIENTES_ESTOQUE = [
    {"id": "ing_1", "name": "Ovos (unidade)", "category": "Ingredientes"},
    {"id": "ing_2", "name": "Atum (porção)", "category": "Ingredientes"},
    {"id": "ing_3", "name": "Queijo Branco (porção)", "category": "Ingredientes"},
    {"id": "ing_4", "name": "Mussarela (porção)", "category": "Ingredientes"},
    {"id": "ing_5", "name": "Frango Desfiado (porção)", "category": "Ingredientes"},
    {"id": "ing_6", "name": "Peito de Peru (porção)", "category": "Ingredientes"},
    {"id": "ing_7", "name": "Mel (porção)", "category": "Ingredientes"},
    {"id": "ing_8", "name": "Granola (porção)", "category": "Ingredientes"},
    {"id": "ing_9", "name": "Nutella (porção)", "category": "Ingredientes"},
    {"id": "ing_10", "name": "Pão Integral (unidade)", "category": "Ingredientes"},
    {"id": "ing_11", "name": "Requeijão (porção)", "category": "Ingredientes"},
    {"id": "ing_12", "name": "Whey Protein (dose)", "category": "Ingredientes"},
    {"id": "ing_13", "name": "Açaí (litro)", "category": "Ingredientes"},
    {"id": "ing_14", "name": "Leite (litro)", "category": "Ingredientes"},
    {"id": "ing_15", "name": "Café (kg)", "category": "Ingredientes"},
]

class StockItemCreate(BaseModel):
    name: str
    category: str = "Ingredientes"
    quantity: int = 0
    min_quantity: int = 5

@api_router.get("/stock/{store}")
async def get_stock(store: StoreLocation):
    stock_items = await db.stock.find({"store": store.value}, {"_id": 0}).to_list(1000)
    
    # Get bebidas from menu
    bebidas = [item for item in MENU_DATA if item["category"] in STOCK_CATEGORIES]
    menu_map = {item["id"]: item for item in bebidas}
    
    result = []
    for stock in stock_items:
        menu_item = menu_map.get(stock["menu_item_id"])
        ingrediente = next((i for i in INGREDIENTES_ESTOQUE if i["id"] == stock["menu_item_id"]), None)
        
        if menu_item:
            result.append({
                **stock,
                "name": menu_item["name"],
                "category": menu_item["category"],
                "low_stock": stock["quantity"] <= stock.get("min_quantity", 2),
                "type": "bebida"
            })
        elif ingrediente:
            result.append({
                **stock,
                "name": ingrediente["name"],
                "category": ingrediente["category"],
                "low_stock": stock["quantity"] <= stock.get("min_quantity", 2),
                "type": "ingrediente"
            })
        elif stock.get("name"):
            # Custom item added by user
            result.append({
                **stock,
                "low_stock": stock["quantity"] <= stock.get("min_quantity", 2),
                "type": "custom"
            })
    
    return {"stock": result}

@api_router.put("/stock/{store}/{menu_item_id}")
async def update_stock(store: StoreLocation, menu_item_id: str, stock_update: StockUpdate):
    await db.stock.update_one(
        {"menu_item_id": menu_item_id, "store": store.value},
        {
            "$set": {
                "quantity": stock_update.quantity,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    stock = await db.stock.find_one({"menu_item_id": menu_item_id, "store": store.value}, {"_id": 0})
    return stock

@api_router.post("/stock/{store}/add")
async def add_stock_item(store: StoreLocation, item: StockItemCreate):
    """Add a new custom item to stock"""
    new_id = f"custom_{str(uuid.uuid4())[:8]}"
    
    doc = {
        "id": str(uuid.uuid4()),
        "menu_item_id": new_id,
        "store": store.value,
        "name": item.name,
        "category": item.category,
        "quantity": item.quantity,
        "min_quantity": item.min_quantity,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.stock.insert_one(doc)
    return {**doc, "_id": None}

@api_router.delete("/stock/{store}/{menu_item_id}")
async def delete_stock_item(store: StoreLocation, menu_item_id: str):
    """Delete a custom stock item"""
    if not menu_item_id.startswith("custom_"):
        raise HTTPException(status_code=400, detail="Só é possível deletar itens personalizados")
    
    result = await db.stock.delete_one({"menu_item_id": menu_item_id, "store": store.value})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    return {"message": "Item removido"}

@api_router.post("/stock/{store}/initialize")
async def initialize_stock(store: StoreLocation, default_quantity: int = 50):
    """Initialize stock for bebidas and ingredientes only"""
    # Bebidas
    bebidas = [item for item in MENU_DATA if item["category"] in STOCK_CATEGORIES]
    for item in bebidas:
        await db.stock.update_one(
            {"menu_item_id": item["id"], "store": store.value},
            {
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "menu_item_id": item["id"],
                    "store": store.value,
                    "quantity": default_quantity,
                    "min_quantity": 5,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
    
    # Ingredientes
    for item in INGREDIENTES_ESTOQUE:
        await db.stock.update_one(
            {"menu_item_id": item["id"], "store": store.value},
            {
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "menu_item_id": item["id"],
                    "store": store.value,
                    "quantity": default_quantity,
                    "min_quantity": 10,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
    
    return {"message": f"Estoque inicializado para {store.value}"}

# ==================== KITCHEN ROUTES ====================

@api_router.get("/kitchen/{store}/stats")
async def get_kitchen_stats(store: StoreLocation):
    pending = await db.orders.count_documents({"store": store.value, "status": "received"})
    preparing = await db.orders.count_documents({"store": store.value, "status": "preparing"})
    ready = await db.orders.count_documents({"store": store.value, "status": "ready"})
    
    return {"pending": pending, "preparing": preparing, "ready": ready}

# ==================== CASH REGISTER ROUTES ====================

@api_router.get("/cash/{store}/today")
async def get_today_cash(store: StoreLocation):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    orders = await db.orders.find({
        "store": store.value,
        "status": {"$in": ["ready", "delivered"]},  # Conta pedidos prontos E entregues
        "created_at": {"$gte": today.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    # Total VALUE by payment method (in R$)
    by_payment_value = {"pix": 0, "debit": 0, "credit": 0, "cash": 0, "prazo": 0}
    total = 0
    
    # By shift (06:00-14:00 and 14:00-22:00)
    shift_morning = {"total": 0, "count": 0, "by_payment": {"pix": 0, "debit": 0, "credit": 0, "cash": 0, "prazo": 0}}
    shift_afternoon = {"total": 0, "count": 0, "by_payment": {"pix": 0, "debit": 0, "credit": 0, "cash": 0, "prazo": 0}}
    
    for order in orders:
        payment = order.get("payment_method", "cash")
        amount = order.get("total", 0)
        by_payment_value[payment] = by_payment_value.get(payment, 0) + amount  # Value in R$
        total += amount
        
        # Determine shift based on order time (convert UTC to Brazil time -3 hours)
        created_at = order.get("created_at", "")
        try:
            if isinstance(created_at, str):
                order_time = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            else:
                order_time = created_at
            
            # Convert UTC to Brazil timezone (UTC-3)
            brazil_hour = (order_time.hour - 3) % 24
            if 6 <= brazil_hour < 14:
                shift_morning["total"] += amount
                shift_morning["count"] += 1
                shift_morning["by_payment"][payment] += amount  # Value in R$
            else:
                shift_afternoon["total"] += amount
                shift_afternoon["count"] += 1
                shift_afternoon["by_payment"][payment] += amount  # Value in R$
        except Exception:
            shift_afternoon["total"] += amount
            shift_afternoon["count"] += 1
            shift_afternoon["by_payment"][payment] += amount  # Value in R$
    
    return {
        "date": today.strftime("%Y-%m-%d"),
        "total": total,
        "by_payment_method": by_payment_value,
        "order_count": len(orders),
        "shifts": {
            "morning": {
                "label": "06:00 - 14:00",
                **shift_morning
            },
            "afternoon": {
                "label": "14:00 - 22:00",
                **shift_afternoon
            }
        }
    }

# ==================== GESTOR ROUTES (Protected) ====================

@api_router.get("/gestor/dashboard")
async def get_gestor_dashboard(username: str = Depends(verify_gestor)):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = today.replace(day=1)
    
    result = {"stores": {}}
    
    for store_key in STORES.keys():
        # Today's orders
        today_orders = await db.orders.find({
            "store": store_key,
            "created_at": {"$gte": today.isoformat()}
        }, {"_id": 0}).to_list(1000)
        
        # Month's orders
        month_orders = await db.orders.find({
            "store": store_key,
            "created_at": {"$gte": month_start.isoformat()}
        }, {"_id": 0}).to_list(10000)
        
        # Calculate totals - inclui pedidos prontos e entregues
        today_total = sum(o.get("total", 0) for o in today_orders if o.get("status") in ["ready", "delivered"])
        month_total = sum(o.get("total", 0) for o in month_orders if o.get("status") in ["ready", "delivered"])
        
        # By payment method (today)
        today_by_payment = {"pix": 0, "debit": 0, "credit": 0, "cash": 0}
        for order in today_orders:
            if order.get("status") in ["ready", "delivered"]:
                pm = order.get("payment_method", "cash")
                today_by_payment[pm] = today_by_payment.get(pm, 0) + order.get("total", 0)
        
        # Product sales count
        product_sales = {}
        for order in month_orders:
            if order.get("status") in ["ready", "delivered"]:
                for item in order.get("items", []):
                    name = item.get("name", "").split(" + ")[0]  # Remove adicionais from name
                    if name not in product_sales:
                        product_sales[name] = {"count": 0, "revenue": 0}
                    product_sales[name]["count"] += item.get("quantity", 1)
                    product_sales[name]["revenue"] += item.get("price", 0) * item.get("quantity", 1)
        
        # Top and low products
        sorted_products = sorted(product_sales.items(), key=lambda x: x[1]["count"], reverse=True)
        top_products = [{"name": k, **v} for k, v in sorted_products[:5]]
        low_products = [{"name": k, **v} for k, v in sorted_products[-5:] if v["count"] > 0]
        
        # Stock alerts
        low_stock = await db.stock.find({
            "store": store_key,
            "quantity": {"$lte": 5}
        }, {"_id": 0}).to_list(100)
        
        result["stores"][store_key] = {
            "name": STORES[store_key]["name"],
            "today": {
                "total": today_total,
                "order_count": len([o for o in today_orders if o.get("status") in ["ready", "delivered"]]),
                "by_payment_method": today_by_payment
            },
            "month": {
                "total": month_total,
                "order_count": len([o for o in month_orders if o.get("status") in ["ready", "delivered"]])
            },
            "top_products": top_products,
            "low_products": low_products,
            "low_stock_alerts": len(low_stock)
        }
    
    # Combined totals
    result["combined"] = {
        "today_total": sum(s["today"]["total"] for s in result["stores"].values()),
        "month_total": sum(s["month"]["total"] for s in result["stores"].values()),
        "today_orders": sum(s["today"]["order_count"] for s in result["stores"].values()),
        "month_orders": sum(s["month"]["order_count"] for s in result["stores"].values())
    }
    
    return result

@api_router.get("/gestor/sales/{store}")
async def get_store_sales(store: StoreLocation, days: int = 30, username: str = Depends(verify_gestor)):
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    orders = await db.orders.find({
        "store": store.value,
        "status": "delivered",
        "created_at": {"$gte": start_date.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    # Group by day
    daily_sales = {}
    for order in orders:
        date = order.get("created_at", "")[:10]
        if date not in daily_sales:
            daily_sales[date] = {"total": 0, "count": 0}
        daily_sales[date]["total"] += order.get("total", 0)
        daily_sales[date]["count"] += 1
    
    return {
        "store": store.value,
        "period_days": days,
        "daily_sales": daily_sales,
        "total": sum(d["total"] for d in daily_sales.values()),
        "order_count": sum(d["count"] for d in daily_sales.values())
    }

@api_router.get("/gestor/stock/{store}")
async def get_gestor_stock(store: StoreLocation, username: str = Depends(verify_gestor)):
    return await get_stock(store)

@api_router.put("/gestor/stock/{store}/{menu_item_id}")
async def update_gestor_stock(store: StoreLocation, menu_item_id: str, stock_update: StockUpdate, username: str = Depends(verify_gestor)):
    return await update_stock(store, menu_item_id, stock_update)

# ==================== MONTHLY CHART DATA ====================

@api_router.get("/gestor/chart/monthly")
async def get_monthly_chart_data(month: int = None, year: int = None, username: str = Depends(verify_gestor)):
    """Get daily sales data for a specific month for chart visualization"""
    now = datetime.now(timezone.utc)
    
    # Use provided month/year or current
    target_month = month if month else now.month
    target_year = year if year else now.year
    
    month_start = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
    
    # Calculate month end
    if target_month == 12:
        month_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        month_end = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)
    
    # Get all completed orders this month
    orders = await db.orders.find({
        "status": {"$in": ["ready", "delivered", "received"]},
        "created_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
    }, {"_id": 0, "created_at": 1, "total": 1, "store": 1}).to_list(10000)
    
    # Get number of days in month
    import calendar
    days_in_month = calendar.monthrange(target_year, target_month)[1]
    
    # Group by day
    daily_data = {}
    for i in range(days_in_month):
        day_date = month_start + timedelta(days=i)
        day_str = day_date.strftime("%Y-%m-%d")
        daily_data[day_str] = {"date": day_str, "day": i + 1, "total": 0, "count": 0}
    
    for order in orders:
        date = order.get("created_at", "")[:10]
        if date in daily_data:
            daily_data[date]["total"] += order.get("total", 0)
            daily_data[date]["count"] += 1
    
    # Convert to sorted list
    chart_data = sorted(daily_data.values(), key=lambda x: x["date"])
    
    month_names = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                   "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
    
    return {
        "month": f"{month_names[target_month]} {target_year}",
        "month_num": target_month,
        "year": target_year,
        "data": chart_data,
        "total_month": sum(d["total"] for d in chart_data),
        "total_orders": sum(d["count"] for d in chart_data)
    }

@api_router.get("/gestor/chart/daily")
async def get_daily_chart_data(date: str = None, username: str = Depends(verify_gestor)):
    """Get hourly sales data for a specific day"""
    now = datetime.now(timezone.utc)
    
    # Parse date or use today
    if date:
        target_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    else:
        target_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    day_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    
    # Get all completed orders this day
    orders = await db.orders.find({
        "status": {"$in": ["ready", "delivered", "received"]},
        "created_at": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()}
    }, {"_id": 0, "created_at": 1, "total": 1, "store": 1, "items": 1}).to_list(10000)
    
    # Group by hour
    hourly_data = {}
    for hour in range(24):
        hour_str = f"{hour:02d}:00"
        hourly_data[hour] = {"hour": hour_str, "total": 0, "count": 0}
    
    for order in orders:
        try:
            order_time = datetime.fromisoformat(order.get("created_at", "").replace("Z", "+00:00"))
            # Convert UTC to Brazil timezone (UTC-3)
            brazil_hour = (order_time.hour - 3) % 24
            hourly_data[brazil_hour]["total"] += order.get("total", 0)
            hourly_data[brazil_hour]["count"] += 1
        except:
            pass
    
    # Convert to sorted list
    chart_data = sorted(hourly_data.values(), key=lambda x: x["hour"])
    
    return {
        "date": target_date.strftime("%d/%m/%Y"),
        "date_iso": target_date.strftime("%Y-%m-%d"),
        "data": chart_data,
        "total_day": sum(d["total"] for d in chart_data),
        "total_orders": sum(d["count"] for d in chart_data),
        "orders": [{"time": o.get("created_at", "")[-8:-3], "total": o.get("total", 0), "items": len(o.get("items", []))} for o in orders]
    }

@api_router.get("/gestor/chart/yearly")
async def get_yearly_chart_data(year: int = None, username: str = Depends(verify_gestor)):
    """Get monthly sales data for a specific year"""
    now = datetime.now(timezone.utc)
    target_year = year if year else now.year
    
    year_start = datetime(target_year, 1, 1, tzinfo=timezone.utc)
    year_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
    
    # Get all completed orders this year
    orders = await db.orders.find({
        "status": {"$in": ["ready", "delivered", "received"]},
        "created_at": {"$gte": year_start.isoformat(), "$lt": year_end.isoformat()}
    }, {"_id": 0, "created_at": 1, "total": 1, "store": 1}).to_list(100000)
    
    # Group by month
    month_names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    monthly_data = {}
    for month in range(1, 13):
        monthly_data[month] = {"month": month, "month_name": month_names[month-1], "total": 0, "count": 0}
    
    for order in orders:
        try:
            order_date = datetime.fromisoformat(order.get("created_at", "").replace("Z", "+00:00"))
            month = order_date.month
            monthly_data[month]["total"] += order.get("total", 0)
            monthly_data[month]["count"] += 1
        except:
            pass
    
    # Convert to sorted list
    chart_data = sorted(monthly_data.values(), key=lambda x: x["month"])
    
    return {
        "year": target_year,
        "data": chart_data,
        "total_year": sum(d["total"] for d in chart_data),
        "total_orders": sum(d["count"] for d in chart_data)
    }

# ==================== SALES BY CATEGORY ====================

@api_router.get("/gestor/sales-by-category")
async def get_sales_by_category(username: str = Depends(verify_gestor)):
    """Get sales data grouped by product category for the current month"""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get all completed orders this month
    orders = await db.orders.find({
        "status": {"$in": ["ready", "delivered"]},
        "created_at": {"$gte": month_start.isoformat()}
    }, {"_id": 0, "items": 1, "total": 1, "store": 1}).to_list(10000)
    
    # Group by category
    category_sales = {}
    
    # Build a map of item IDs to categories from MENU_DATA
    item_category_map = {item["id"]: item["category"] for item in MENU_DATA}
    
    for order in orders:
        for item in order.get("items", []):
            # Get category from item or lookup
            item_id = item.get("menu_item_id", "").split("-")[0]  # Remove adicional suffix
            category = item.get("category") or item_category_map.get(item_id, "Outros")
            
            if category not in category_sales:
                category_sales[category] = {
                    "category": category,
                    "count": 0,
                    "revenue": 0,
                    "items": {}
                }
            
            qty = item.get("quantity", 1)
            item_total = item.get("price", 0) * qty
            
            category_sales[category]["count"] += qty
            category_sales[category]["revenue"] += item_total
            
            # Track individual items
            item_name = item.get("name", "Desconhecido")
            if item_name not in category_sales[category]["items"]:
                category_sales[category]["items"][item_name] = {"count": 0, "revenue": 0}
            category_sales[category]["items"][item_name]["count"] += qty
            category_sales[category]["items"][item_name]["revenue"] += item_total
    
    # Convert to sorted list
    categories_list = sorted(category_sales.values(), key=lambda x: x["count"], reverse=True)
    
    # Convert items dict to sorted list for each category
    for cat in categories_list:
        cat["top_items"] = sorted(
            [{"name": k, **v} for k, v in cat["items"].items()],
            key=lambda x: x["count"],
            reverse=True
        )[:10]  # Top 10 items per category
        del cat["items"]  # Remove the dict version
    
    return {
        "month": now.strftime("%B %Y"),
        "categories": categories_list,
        "total_items_sold": sum(c["count"] for c in categories_list),
        "total_revenue": sum(c["revenue"] for c in categories_list)
    }

# ==================== MENU MANAGEMENT ====================

class MenuItemCreate(BaseModel):
    name: str
    description: str = ""
    price: float
    category: str
    store: str
    image_url: str = ""

class MenuItemUpdate(BaseModel):
    name: str = None
    description: str = None
    price: float = None
    category: str = None
    image_url: str = None
    available: bool = None

@api_router.get("/gestor/menu/{store}")
async def get_store_menu(store: StoreLocation, username: str = Depends(verify_gestor)):
    """Get menu items for a store"""
    menu = await db.menu.find({"store": store.value}, {"_id": 0}).to_list(500)
    return {"menu": menu, "count": len(menu)}

@api_router.post("/gestor/menu")
async def create_menu_item(item: MenuItemCreate, username: str = Depends(verify_gestor)):
    """Create a new menu item in BOTH stores"""
    base_id = str(uuid.uuid4())
    stores = ["runner", "gym-londres"]
    created_items = []
    
    for store in stores:
        menu_item = {
            "id": f"{base_id}-{store}",
            "name": item.name,
            "description": item.description,
            "price": item.price,
            "category": item.category,
            "store": store,
            "image_url": item.image_url,
            "available": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.menu.insert_one(menu_item)
        
        # Also add to stock with default quantity
        await db.stock.insert_one({
            "store": store,
            "menu_item_id": menu_item["id"],
            "name": item.name,
            "category": item.category,
            "quantity": 50,
            "low_stock": False
        })
        created_items.append(menu_item)
    
    return {"success": True, "items": [{**i, "_id": None} for i in created_items], "message": "Item adicionado em ambas as lojas!"}

@api_router.put("/gestor/menu/{item_id}")
async def update_menu_item(item_id: str, update: MenuItemUpdate, username: str = Depends(verify_gestor)):
    """Update a menu item"""
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum dado para atualizar")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.menu.update_one({"id": item_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    
    # Update stock name if name changed
    if "name" in update_data:
        await db.stock.update_many({"menu_item_id": item_id}, {"$set": {"name": update_data["name"]}})
    
    return {"success": True, "message": "Item atualizado"}

@api_router.delete("/gestor/menu/{item_id}")
async def delete_menu_item(item_id: str, username: str = Depends(verify_gestor)):
    """Delete a menu item"""
    result = await db.menu.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    
    # Also remove from stock
    await db.stock.delete_many({"menu_item_id": item_id})
    
    return {"success": True, "message": "Item removido"}

# ==================== PRAZO (CREDIT/TAB) MANAGEMENT ====================
PRAZO_PASSWORD = "1234"

class PrazoCustomerCreate(BaseModel):
    name: str
    phone: str = ""
    notes: str = ""

class PrazoPayment(BaseModel):
    amount: float
    password: str

@api_router.get("/prazo/customers")
async def get_prazo_customers():
    """Get all registered prazo customers"""
    customers = await db.prazo_customers.find({}, {"_id": 0}).to_list(500)
    return {"customers": customers}

@api_router.post("/prazo/customers")
async def create_prazo_customer(customer: PrazoCustomerCreate, username: str = Depends(verify_gestor)):
    """Register a new prazo customer"""
    # Check if customer already exists
    existing = await db.prazo_customers.find_one({"name": {"$regex": f"^{customer.name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Cliente já cadastrado")
    
    new_customer = {
        "id": str(uuid.uuid4()),
        "name": customer.name,
        "phone": customer.phone,
        "notes": customer.notes,
        "total_debt": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.prazo_customers.insert_one(new_customer)
    return {**new_customer, "_id": None}

@api_router.delete("/prazo/customers/{customer_id}")
async def delete_prazo_customer(customer_id: str, username: str = Depends(verify_gestor)):
    """Delete a prazo customer"""
    result = await db.prazo_customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return {"success": True, "message": "Cliente removido"}

@api_router.get("/prazo/debts")
async def get_prazo_debts():
    """Get all prazo debts summary"""
    # Get all unpaid prazo orders
    prazo_orders = await db.orders.find({
        "payment_method": "prazo",
        "prazo_paid": {"$ne": True}
    }, {"_id": 0}).to_list(1000)
    
    # Group by customer name
    debts_by_customer = {}
    for order in prazo_orders:
        name = order.get("customer_name", "Desconhecido")
        if name not in debts_by_customer:
            debts_by_customer[name] = {"name": name, "total": 0, "orders": [], "order_count": 0}
        debts_by_customer[name]["total"] += order.get("total", 0)
        debts_by_customer[name]["order_count"] += 1
        debts_by_customer[name]["orders"].append({
            "id": order.get("id"),
            "total": order.get("total"),
            "date": order.get("created_at"),
            "items": order.get("items", [])
        })
    
    # Sort by total debt descending
    debts = sorted(debts_by_customer.values(), key=lambda x: x["total"], reverse=True)
    total_prazo = sum(d["total"] for d in debts)
    
    return {
        "debts": debts,
        "total_prazo": total_prazo,
        "customer_count": len(debts)
    }

@api_router.post("/prazo/pay/{order_id}")
async def pay_prazo_order(order_id: str, payment: PrazoPayment):
    """Mark a prazo order as paid (requires password)"""
    if payment.password != PRAZO_PASSWORD:
        raise HTTPException(status_code=403, detail="Senha incorreta")
    
    result = await db.orders.update_one(
        {"id": order_id, "payment_method": "prazo"},
        {"$set": {"prazo_paid": True, "prazo_paid_at": datetime.now(timezone.utc).isoformat(), "prazo_paid_amount": payment.amount}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    return {"success": True, "message": "Pagamento registrado"}

@api_router.post("/prazo/pay-all/{customer_name}")
async def pay_all_prazo_customer(customer_name: str, payment: PrazoPayment):
    """Mark all prazo orders for a customer as paid (requires password)"""
    if payment.password != PRAZO_PASSWORD:
        raise HTTPException(status_code=403, detail="Senha incorreta")
    
    result = await db.orders.update_many(
        {"customer_name": customer_name, "payment_method": "prazo", "prazo_paid": {"$ne": True}},
        {"$set": {"prazo_paid": True, "prazo_paid_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": f"{result.modified_count} pedidos pagos", "count": result.modified_count}

# ==================== EXPENSES (GASTOS) MANAGEMENT ====================
from emergentintegrations.llm.openai import LlmChat, ImageContent
from emergentintegrations.llm.chat import UserMessage
import asyncio

EXPENSE_CATEGORIES = [
    "contador",
    "fornecedor", 
    "mercado",
    "suplementos",
    "VT",
    "Vivo",
    "sistema",
    "salário",
    "outros"
]

class ExpenseCreate(BaseModel):
    description: str
    amount: float
    category: str
    store: str = "all"  # "runner", "gym-londres", or "all"
    image_url: str = ""
    notes: str = ""

class ExpenseAnalysis(BaseModel):
    image_base64: str

@api_router.get("/expenses")
async def get_expenses(store: Optional[str] = None, category: Optional[str] = None, username: str = Depends(verify_gestor)):
    """Get all expenses with optional filters"""
    query = {}
    if store and store != "all":
        query["$or"] = [{"store": store}, {"store": "all"}]
    if category:
        query["category"] = category
    
    expenses = await db.expenses.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Calculate totals by category
    totals_by_category = {}
    for exp in expenses:
        cat = exp.get("category", "outros")
        totals_by_category[cat] = totals_by_category.get(cat, 0) + exp.get("amount", 0)
    
    total = sum(e.get("amount", 0) for e in expenses)
    
    return {
        "expenses": expenses,
        "total": total,
        "by_category": totals_by_category,
        "categories": EXPENSE_CATEGORIES
    }

@api_router.get("/expenses/monthly")
async def get_monthly_expenses(username: str = Depends(verify_gestor)):
    """Get expenses for current month with daily breakdown"""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    expenses = await db.expenses.find({
        "created_at": {"$gte": month_start.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    # Group by day
    daily_data = {}
    for i in range(now.day):
        day = (month_start + timedelta(days=i)).strftime("%Y-%m-%d")
        daily_data[day] = {"date": day, "day": i + 1, "total": 0, "by_category": {}}
    
    for exp in expenses:
        date = exp.get("created_at", "")[:10]
        if date in daily_data:
            daily_data[date]["total"] += exp.get("amount", 0)
            cat = exp.get("category", "outros")
            daily_data[date]["by_category"][cat] = daily_data[date]["by_category"].get(cat, 0) + exp.get("amount", 0)
    
    # Totals by category for the month
    totals_by_category = {}
    for exp in expenses:
        cat = exp.get("category", "outros")
        totals_by_category[cat] = totals_by_category.get(cat, 0) + exp.get("amount", 0)
    
    chart_data = sorted(daily_data.values(), key=lambda x: x["date"])
    
    return {
        "month": now.strftime("%B %Y"),
        "data": chart_data,
        "total_expenses": sum(d["total"] for d in chart_data),
        "by_category": totals_by_category,
        "categories": EXPENSE_CATEGORIES
    }

@api_router.post("/expenses")
async def create_expense(expense: ExpenseCreate, username: str = Depends(verify_gestor)):
    """Create a new expense"""
    new_expense = {
        "id": str(uuid.uuid4()),
        "description": expense.description,
        "amount": expense.amount,
        "category": expense.category,
        "store": expense.store,
        "image_url": expense.image_url,
        "notes": expense.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": username
    }
    await db.expenses.insert_one(new_expense)
    return {**new_expense, "_id": None}

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, username: str = Depends(verify_gestor)):
    """Delete an expense"""
    result = await db.expenses.delete_one({"id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Gasto não encontrado")
    return {"success": True, "message": "Gasto removido"}

@api_router.post("/expenses/analyze-image")
async def analyze_expense_image(analysis: ExpenseAnalysis, username: str = Depends(verify_gestor)):
    """Use AI to analyze expense receipt/invoice image"""
    try:
        llm_key = os.environ.get("EMERGENT_LLM_KEY")
        if not llm_key:
            raise HTTPException(status_code=500, detail="LLM key not configured")
        
        chat = LlmChat(
            api_key=llm_key,
            session_id=f"expense-analysis-{uuid.uuid4()}",
            system_message="""Você é um assistente especializado em analisar notas fiscais, recibos e comprovantes de gastos.
Analise a imagem e extraia as seguintes informações em formato JSON:
{
    "description": "descrição do gasto (o que foi comprado)",
    "amount": valor numérico em reais (apenas o número, sem R$),
    "notes": "nome do estabelecimento ou local onde foi gasto"
}

Responda APENAS com o JSON, sem texto adicional."""
        ).with_model("openai", "gpt-4o")
        
        # Create ImageContent for the image (uses content_type="image" internally)
        image_content = ImageContent(image_base64=analysis.image_base64)
        
        # Create user message with image
        user_message = UserMessage(
            text="Analise este comprovante/nota fiscal e extraia: o valor total, o que foi comprado e onde foi comprado.",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        
        # Parse JSON from response
        import json
        try:
            # Clean response - remove markdown code blocks if present
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            clean_response = clean_response.strip()
            
            result = json.loads(clean_response)
            return {
                "success": True,
                "analysis": result
            }
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "Não foi possível extrair informações da imagem",
                "raw_response": response
            }
            
    except Exception as e:
        logger.error(f"Error analyzing expense image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao analisar imagem: {str(e)}")

# Multi-image analysis for expenses
class MultiImageAnalysis(BaseModel):
    images: list  # List of base64 images

@api_router.post("/expenses/analyze-multiple")
async def analyze_multiple_expense_images(data: MultiImageAnalysis, username: str = Depends(verify_gestor)):
    """Use AI to analyze multiple expense receipt/invoice images and return a list"""
    try:
        llm_key = os.environ.get("EMERGENT_LLM_KEY")
        if not llm_key:
            raise HTTPException(status_code=500, detail="LLM key not configured")
        
        if not data.images or len(data.images) == 0:
            raise HTTPException(status_code=400, detail="Nenhuma imagem enviada")
        
        chat = LlmChat(
            api_key=llm_key,
            session_id=f"expense-multi-{uuid.uuid4()}",
            system_message=f"""Você é um assistente especializado em analisar notas fiscais, recibos e comprovantes de gastos.
Você vai receber {len(data.images)} imagem(ns) de comprovantes.

Para CADA imagem, extraia as informações e retorne um JSON com uma lista:
{{
    "expenses": [
        {{
            "id": 1,
            "description": "o que foi comprado",
            "amount": valor numérico em reais (apenas o número),
            "notes": "nome do estabelecimento/local"
        }}
    ]
}}

Responda APENAS com o JSON, sem texto adicional."""
        ).with_model("openai", "gpt-4o")
        
        # Create ImageContent for each image
        image_contents = [ImageContent(image_base64=img) for img in data.images]
        
        # Create user message with all images
        user_message = UserMessage(
            text=f"Analise estas {len(data.images)} nota(s) fiscal(is) e liste: valor, o que foi comprado e onde foi comprado para cada uma.",
            file_contents=image_contents
        )
        
        response = await chat.send_message(user_message)
        
        # Parse JSON from response
        import json
        try:
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            clean_response = clean_response.strip()
            
            result = json.loads(clean_response)
            return {
                "success": True,
                "count": len(result.get("expenses", [])),
                "expenses": result.get("expenses", [])
            }
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "Não foi possível extrair informações das imagens",
                "raw_response": response
            }
            
    except Exception as e:
        logger.error(f"Error analyzing multiple expense images: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao analisar imagens: {str(e)}")

# ==================== PRAZO WHATSAPP LINK ====================
@api_router.get("/prazo/whatsapp-link/{customer_name}")
async def get_prazo_whatsapp_link(customer_name: str):
    """Generate WhatsApp link for prazo collection"""
    # Get customer info
    customer = await db.prazo_customers.find_one({"name": {"$regex": f"^{customer_name}$", "$options": "i"}})
    
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    phone = customer.get("phone", "")
    if not phone:
        raise HTTPException(status_code=400, detail="Cliente não tem telefone cadastrado")
    
    # Get total debt
    prazo_orders = await db.orders.find({
        "customer_name": {"$regex": f"^{customer_name}$", "$options": "i"},
        "payment_method": "prazo",
        "prazo_paid": {"$ne": True}
    }, {"_id": 0}).to_list(1000)
    
    total_debt = sum(o.get("total", 0) for o in prazo_orders)
    
    # Format phone (remove non-digits and add country code if needed)
    clean_phone = ''.join(filter(str.isdigit, phone))
    if not clean_phone.startswith('55'):
        clean_phone = '55' + clean_phone
    
    # Create message
    message = f"""Olá {customer_name}! 👋

Este é um lembrete de cobrança do GANOH Café Bistrô.

💰 *Valor pendente:* R$ {total_debt:.2f}
📅 *Pedidos:* {len(prazo_orders)} pedido(s)

Por favor, entre em contato para regularizar sua situação.

Obrigado! ☕"""
    
    # URL encode the message
    from urllib.parse import quote
    encoded_message = quote(message)
    
    whatsapp_url = f"https://wa.me/{clean_phone}?text={encoded_message}"
    
    return {
        "url": whatsapp_url,
        "phone": clean_phone,
        "total_debt": total_debt,
        "order_count": len(prazo_orders)
    }

# ==================== UPDATED CHART DATA WITH EXPENSES ====================
@api_router.get("/gestor/chart/monthly-with-expenses")
async def get_monthly_chart_with_expenses(month: int = None, year: int = None, username: str = Depends(verify_gestor)):
    """Get daily sales AND expenses data for a specific month"""
    now = datetime.now(timezone.utc)
    
    target_month = month if month else now.month
    target_year = year if year else now.year
    
    month_start = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
    
    if target_month == 12:
        month_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        month_end = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)
    
    import calendar
    days_in_month = calendar.monthrange(target_year, target_month)[1]
    
    # Get all completed orders this month
    orders = await db.orders.find({
        "status": {"$in": ["ready", "delivered", "received"]},
        "created_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
    }, {"_id": 0, "created_at": 1, "total": 1, "store": 1}).to_list(10000)
    
    # Get all expenses this month
    expenses = await db.expenses.find({
        "created_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    # Group by day
    daily_data = {}
    for i in range(days_in_month):
        day_date = month_start + timedelta(days=i)
        day_str = day_date.strftime("%Y-%m-%d")
        daily_data[day_str] = {
            "date": day_str, 
            "day": i + 1, 
            "revenue": 0, 
            "expenses": 0,
            "profit": 0,
            "order_count": 0,
            "expenses_by_category": {}
        }
    
    for order in orders:
        date = order.get("created_at", "")[:10]
        if date in daily_data:
            daily_data[date]["revenue"] += order.get("total", 0)
            daily_data[date]["order_count"] += 1
    
    for exp in expenses:
        date = exp.get("created_at", "")[:10]
        if date in daily_data:
            daily_data[date]["expenses"] += exp.get("amount", 0)
            cat = exp.get("category", "outros")
            daily_data[date]["expenses_by_category"][cat] = daily_data[date]["expenses_by_category"].get(cat, 0) + exp.get("amount", 0)
    
    # Calculate profit
    for day in daily_data.values():
        day["profit"] = day["revenue"] - day["expenses"]
    
    # Total expenses by category for the month
    expenses_by_category = {}
    for exp in expenses:
        cat = exp.get("category", "outros")
        expenses_by_category[cat] = expenses_by_category.get(cat, 0) + exp.get("amount", 0)
    
    # Convert to sorted list
    chart_data = sorted(daily_data.values(), key=lambda x: x["date"])
    
    total_revenue = sum(d["revenue"] for d in chart_data)
    total_expenses = sum(d["expenses"] for d in chart_data)
    
    month_names = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                   "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
    
    return {
        "month": f"{month_names[target_month]} {target_year}",
        "period": "month",
        "data": chart_data,
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "total_profit": total_revenue - total_expenses,
        "total_orders": sum(d["order_count"] for d in chart_data),
        "expenses_by_category": expenses_by_category,
        "categories": EXPENSE_CATEGORIES
    }

@api_router.get("/gestor/chart/daily-with-expenses")
async def get_daily_chart_with_expenses(date: str = None, username: str = Depends(verify_gestor)):
    """Get hourly sales AND expenses data for a specific day"""
    now = datetime.now(timezone.utc)
    
    if date:
        target_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    else:
        target_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    day_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    
    # Get orders and expenses for this day
    orders = await db.orders.find({
        "status": {"$in": ["ready", "delivered", "received"]},
        "created_at": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()}
    }, {"_id": 0, "created_at": 1, "total": 1}).to_list(10000)
    
    expenses = await db.expenses.find({
        "created_at": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    # Group by hour
    hourly_data = {}
    for hour in range(24):
        hourly_data[hour] = {
            "hour": f"{hour:02d}:00",
            "revenue": 0,
            "expenses": 0,
            "profit": 0,
            "order_count": 0
        }
    
    for order in orders:
        try:
            order_time = datetime.fromisoformat(order.get("created_at", "").replace("Z", "+00:00"))
            brazil_hour = (order_time.hour - 3) % 24
            hourly_data[brazil_hour]["revenue"] += order.get("total", 0)
            hourly_data[brazil_hour]["order_count"] += 1
        except:
            pass
    
    for exp in expenses:
        try:
            exp_time = datetime.fromisoformat(exp.get("created_at", "").replace("Z", "+00:00"))
            brazil_hour = (exp_time.hour - 3) % 24
            hourly_data[brazil_hour]["expenses"] += exp.get("amount", 0)
        except:
            pass
    
    for h in hourly_data.values():
        h["profit"] = h["revenue"] - h["expenses"]
    
    chart_data = sorted(hourly_data.values(), key=lambda x: x["hour"])
    
    total_revenue = sum(d["revenue"] for d in chart_data)
    total_expenses = sum(d["expenses"] for d in chart_data)
    
    return {
        "date": target_date.strftime("%d/%m/%Y"),
        "period": "day",
        "data": chart_data,
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "total_profit": total_revenue - total_expenses,
        "total_orders": sum(d["order_count"] for d in chart_data)
    }

@api_router.get("/gestor/chart/yearly-with-expenses")
async def get_yearly_chart_with_expenses(year: int = None, username: str = Depends(verify_gestor)):
    """Get monthly sales AND expenses data for a specific year"""
    now = datetime.now(timezone.utc)
    target_year = year if year else now.year
    
    year_start = datetime(target_year, 1, 1, tzinfo=timezone.utc)
    year_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
    
    orders = await db.orders.find({
        "status": {"$in": ["ready", "delivered", "received"]},
        "created_at": {"$gte": year_start.isoformat(), "$lt": year_end.isoformat()}
    }, {"_id": 0, "created_at": 1, "total": 1}).to_list(100000)
    
    expenses = await db.expenses.find({
        "created_at": {"$gte": year_start.isoformat(), "$lt": year_end.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    month_names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    monthly_data = {}
    for m in range(1, 13):
        monthly_data[m] = {
            "month": m,
            "month_name": month_names[m-1],
            "revenue": 0,
            "expenses": 0,
            "profit": 0,
            "order_count": 0
        }
    
    for order in orders:
        try:
            order_date = datetime.fromisoformat(order.get("created_at", "").replace("Z", "+00:00"))
            monthly_data[order_date.month]["revenue"] += order.get("total", 0)
            monthly_data[order_date.month]["order_count"] += 1
        except:
            pass
    
    for exp in expenses:
        try:
            exp_date = datetime.fromisoformat(exp.get("created_at", "").replace("Z", "+00:00"))
            monthly_data[exp_date.month]["expenses"] += exp.get("amount", 0)
        except:
            pass
    
    for m in monthly_data.values():
        m["profit"] = m["revenue"] - m["expenses"]
    
    chart_data = sorted(monthly_data.values(), key=lambda x: x["month"])
    
    total_revenue = sum(d["revenue"] for d in chart_data)
    total_expenses = sum(d["expenses"] for d in chart_data)
    
    return {
        "year": target_year,
        "period": "year",
        "data": chart_data,
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "total_profit": total_revenue - total_expenses,
        "total_orders": sum(d["order_count"] for d in chart_data)
    }

# ==================== ADMIN CLEAR DATA ROUTE ====================
CLEAR_DATA_PASSWORD = "152637"

@api_router.post("/admin/clear-data")
async def clear_all_data(password: str):
    """Clear all orders, expenses, and history. Protected with password."""
    if password != CLEAR_DATA_PASSWORD:
        raise HTTPException(status_code=403, detail="Senha incorreta")
    
    # Delete all orders
    await db.orders.delete_many({})
    # Delete all expenses
    await db.expenses.delete_many({})
    # Delete order history
    await db.order_history.delete_many({})
    
    return {"success": True, "message": "Todos os pedidos, gastos e histórico foram apagados"}

@api_router.post("/admin/clear-store/{store}")
async def clear_store_data(store: StoreLocation, password: str):
    """Clear orders for a specific store. Protected with password."""
    if password != CLEAR_DATA_PASSWORD:
        raise HTTPException(status_code=403, detail="Senha incorreta")
    
    # Delete orders for this store
    result = await db.orders.delete_many({"store": store.value})
    # Delete expenses for this store
    await db.expenses.delete_many({"$or": [{"store": store.value}, {"store": "all"}]})
    
    return {"success": True, "message": f"Pedidos e gastos da loja {store.value} apagados", "deleted_count": result.deleted_count}

# ==================== WHATSAPP BOT PROXY ====================
WHATSAPP_BOT_URL = "http://localhost:8002"

@api_router.get("/whatsapp/status")
async def get_whatsapp_status():
    """Proxy to get WhatsApp bot status"""
    try:
        async with httpx.AsyncClient() as client_http:
            response = await client_http.get(f"{WHATSAPP_BOT_URL}/status", timeout=3.0)
            return response.json()
    except Exception as e:
        return {"status": "offline", "connected": False, "qrCode": None}

@api_router.get("/whatsapp/qr")
async def get_whatsapp_qr():
    """Proxy to get WhatsApp QR code"""
    try:
        async with httpx.AsyncClient() as client_http:
            response = await client_http.get(f"{WHATSAPP_BOT_URL}/qr", timeout=3.0)
            return response.json()
    except Exception as e:
        return {"qrCode": None, "connected": False}

@api_router.get("/whatsapp/groups")
async def get_whatsapp_groups():
    """Proxy to get WhatsApp groups"""
    try:
        async with httpx.AsyncClient() as client_http:
            response = await client_http.get(f"{WHATSAPP_BOT_URL}/groups", timeout=5.0)
            return response.json()
    except Exception as e:
        return {"success": False, "groups": [], "error": str(e)}

class WhatsAppTargetUpdate(BaseModel):
    target: str

@api_router.post("/whatsapp/set-target")
async def set_whatsapp_target(data: WhatsAppTargetUpdate):
    """Proxy to set WhatsApp notification target"""
    try:
        async with httpx.AsyncClient() as client_http:
            response = await client_http.post(
                f"{WHATSAPP_BOT_URL}/set-target",
                json={"target": data.target},
                timeout=5.0
            )
            return response.json()
    except Exception as e:
        return {"success": False, "error": str(e)}

class WhatsAppJoinGroup(BaseModel):
    inviteLink: str

@api_router.post("/whatsapp/join-group")
async def join_whatsapp_group(data: WhatsAppJoinGroup):
    """Proxy to join a WhatsApp group via invite link"""
    try:
        async with httpx.AsyncClient() as client_http:
            response = await client_http.post(
                f"{WHATSAPP_BOT_URL}/join-group",
                json={"inviteLink": data.inviteLink},
                timeout=30.0
            )
            return response.json()
    except Exception as e:
        return {"success": False, "error": str(e)}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_db_client():
    """Initialize database and default tenant"""
    await ensure_default_tenant()
    logger.info("Database initialized, default tenant ensured")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
