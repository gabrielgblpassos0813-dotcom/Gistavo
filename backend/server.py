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

# Gestor credentials (in production, use env variables)
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
    "Suplementos"
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

@api_router.get("/stores")
async def get_stores():
    return {"stores": STORES}

@api_router.get("/menu/{store}")
async def get_menu(store: StoreLocation):
    # Get stock for bebidas only (other items don't need stock control)
    stock_docs = await db.stock.find({"store": store.value}, {"_id": 0}).to_list(1000)
    stock_map = {s["menu_item_id"]: s["quantity"] for s in stock_docs}
    
    # Add availability based on stock (only for bebidas)
    items_with_stock = []
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
    
    return {
        "items": items_with_stock, 
        "categories": CATEGORIES, 
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
    
    order = Order(
        store=order_input.store,
        customer_name=order_input.customer_name,
        items=order_input.items,
        total=order_input.total,
        payment_method=order_input.payment_method,
        prep_time=15,
        pickup_time=order_input.pickup_time
    )
    
    doc = order.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    doc['store'] = doc['store'].value
    doc['payment_method'] = doc['payment_method'].value
    doc['status'] = doc['status'].value
    
    await db.orders.insert_one(doc)
    
    # Update stock
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

@api_router.get("/orders/{store}/{order_id}")
async def get_order(store: StoreLocation, order_id: str):
    order = await db.orders.find_one({"id": order_id, "store": store.value}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return order

@api_router.patch("/orders/{store}/{order_id}/status")
async def update_order_status(store: StoreLocation, order_id: str, status_update: OrderStatusUpdate):
    result = await db.orders.update_one(
        {"id": order_id, "store": store.value},
        {"$set": {"status": status_update.status.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return order

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
                "low_stock": stock["quantity"] <= stock.get("min_quantity", 5),
                "type": "bebida"
            })
        elif ingrediente:
            result.append({
                **stock,
                "name": ingrediente["name"],
                "category": ingrediente["category"],
                "low_stock": stock["quantity"] <= stock.get("min_quantity", 5),
                "type": "ingrediente"
            })
        elif stock.get("name"):
            # Custom item added by user
            result.append({
                **stock,
                "low_stock": stock["quantity"] <= stock.get("min_quantity", 5),
                "type": "custom"
            })
    
    return {"stock": result}

@api_router.put("/stock/{store}/{menu_item_id}")
async def update_stock(store: StoreLocation, menu_item_id: str, stock_update: StockUpdate):
    result = await db.stock.update_one(
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
        "status": "delivered",
        "created_at": {"$gte": today.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    # Total by payment method
    by_payment = {"pix": 0, "debit": 0, "credit": 0, "cash": 0}
    total = 0
    
    # By shift (06:00-14:00 and 14:00-22:00)
    shift_morning = {"total": 0, "count": 0, "by_payment": {"pix": 0, "debit": 0, "credit": 0, "cash": 0}}
    shift_afternoon = {"total": 0, "count": 0, "by_payment": {"pix": 0, "debit": 0, "credit": 0, "cash": 0}}
    
    for order in orders:
        payment = order.get("payment_method", "cash")
        amount = order.get("total", 0)
        by_payment[payment] = by_payment.get(payment, 0) + amount
        total += amount
        
        # Determine shift based on order time
        created_at = order.get("created_at", "")
        try:
            if isinstance(created_at, str):
                order_time = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            else:
                order_time = created_at
            
            hour = order_time.hour
            if 6 <= hour < 14:
                shift_morning["total"] += amount
                shift_morning["count"] += 1
                shift_morning["by_payment"][payment] += amount
            else:
                shift_afternoon["total"] += amount
                shift_afternoon["count"] += 1
                shift_afternoon["by_payment"][payment] += amount
        except:
            shift_afternoon["total"] += amount
            shift_afternoon["count"] += 1
            shift_afternoon["by_payment"][payment] += amount
    
    return {
        "date": today.strftime("%Y-%m-%d"),
        "total": total,
        "by_payment_method": by_payment,
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
        
        # Calculate totals
        today_total = sum(o.get("total", 0) for o in today_orders if o.get("status") == "delivered")
        month_total = sum(o.get("total", 0) for o in month_orders if o.get("status") == "delivered")
        
        # By payment method (today)
        today_by_payment = {"pix": 0, "debit": 0, "credit": 0, "cash": 0}
        for order in today_orders:
            if order.get("status") == "delivered":
                pm = order.get("payment_method", "cash")
                today_by_payment[pm] = today_by_payment.get(pm, 0) + order.get("total", 0)
        
        # Product sales count
        product_sales = {}
        for order in month_orders:
            if order.get("status") == "delivered":
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
                "order_count": len([o for o in today_orders if o.get("status") == "delivered"]),
                "by_payment_method": today_by_payment
            },
            "month": {
                "total": month_total,
                "order_count": len([o for o in month_orders if o.get("status") == "delivered"])
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
