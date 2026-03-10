from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class OrderStatus(str, Enum):
    RECEIVED = "received"
    PREPARING = "preparing"
    READY = "ready"
    DELIVERED = "delivered"

# Models
class MenuItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float
    category: str
    image_url: Optional[str] = None
    prep_time: int = 15  # minutes
    available: bool = True

class OrderItem(BaseModel):
    menu_item_id: str
    name: str
    price: float
    quantity: int

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_name: str
    items: List[OrderItem]
    total: float
    status: OrderStatus = OrderStatus.RECEIVED
    prep_time: int = 15
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderCreate(BaseModel):
    customer_name: str
    items: List[OrderItem]
    total: float

class OrderStatusUpdate(BaseModel):
    status: OrderStatus

# Menu Data - GANOH Café Bistrô
MENU_DATA = [
    # Omeletes, Tapiocas e Crepiocas
    {"id": "1", "name": "Frango com Requeijão", "description": "Omelete/Tapioca com frango desfiado e requeijão cremoso", "price": 25.50, "category": "Omeletes, Tapiocas e Crepiocas", "image_url": "https://images.unsplash.com/photo-1766146431872-a4472ccd3889?w=400&q=80", "prep_time": 15},
    {"id": "2", "name": "Frango, Mussarela, Tomate e Orégano", "description": "Combinação clássica com frango, queijo mussarela, tomate fresco e orégano", "price": 26.00, "category": "Omeletes, Tapiocas e Crepiocas", "image_url": "https://images.unsplash.com/photo-1636044991510-ca767084a030?w=400&q=80", "prep_time": 15},
    {"id": "3", "name": "Queijo Branco, Tomate e Orégano", "description": "Opção leve com queijo branco, tomate e orégano", "price": 23.50, "category": "Omeletes, Tapiocas e Crepiocas", "image_url": "https://images.unsplash.com/photo-1700324673015-52cddc228533?w=400&q=80", "prep_time": 15},
    {"id": "4", "name": "Queijo Branco, Peito de Peru e Orégano", "description": "Queijo branco com peito de peru e orégano", "price": 24.00, "category": "Omeletes, Tapiocas e Crepiocas", "image_url": "https://images.unsplash.com/photo-1766146431872-a4472ccd3889?w=400&q=80", "prep_time": 15},
    {"id": "5", "name": "Mussarela, Peito de Peru, Tomate e Orégano", "description": "Mussarela derretida com peito de peru, tomate e orégano", "price": 23.50, "category": "Omeletes, Tapiocas e Crepiocas", "image_url": "https://images.unsplash.com/photo-1636044991510-ca767084a030?w=400&q=80", "prep_time": 15},
    {"id": "6", "name": "Atum com Requeijão", "description": "Atum em lascas com requeijão cremoso", "price": 26.50, "category": "Omeletes, Tapiocas e Crepiocas", "image_url": "https://images.unsplash.com/photo-1700324673015-52cddc228533?w=400&q=80", "prep_time": 15},
    {"id": "7", "name": "Atum, Mussarela e Tomate", "description": "Atum com mussarela e tomate fresco", "price": 26.50, "category": "Omeletes, Tapiocas e Crepiocas", "image_url": "https://images.unsplash.com/photo-1766146431872-a4472ccd3889?w=400&q=80", "prep_time": 15},
    {"id": "8", "name": "Especial", "description": "Frango, mussarela, peito de peru, tomate e orégano - nossa combinação mais completa", "price": 27.50, "category": "Omeletes, Tapiocas e Crepiocas", "image_url": "https://images.unsplash.com/photo-1636044991510-ca767084a030?w=400&q=80", "prep_time": 15},
    
    # Brunchs
    {"id": "9", "name": "Saudável", "description": "3 ovos mexidos, pão integral, café, fruta (mamão ou banana), aveia e mel", "price": 21.00, "category": "Brunchs", "image_url": "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&q=80", "prep_time": 15},
    {"id": "10", "name": "Café Egg", "description": "2 ovos mexidos, café pequeno e pão integral", "price": 19.00, "category": "Brunchs", "image_url": "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&q=80", "prep_time": 15},
    {"id": "11", "name": "Mineirinho", "description": "2 ovos fritos, queijo minas, duas fatias de pão integral e café com leite", "price": 23.00, "category": "Brunchs", "image_url": "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&q=80", "prep_time": 15},
    {"id": "12", "name": "Honey", "description": "2 ovos mexidos, banana, granola e mel", "price": 18.00, "category": "Brunchs", "image_url": "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&q=80", "prep_time": 15},
    {"id": "13", "name": "Banana Bliss", "description": "Banana, aveia, canela e mel", "price": 10.00, "category": "Brunchs", "image_url": "https://images.unsplash.com/photo-1571748982800-fa51082c2224?w=400&q=80", "prep_time": 15},
    {"id": "14", "name": "Banana Power", "description": "Banana, proteína, aveia, canela e mel", "price": 15.00, "category": "Brunchs", "image_url": "https://images.unsplash.com/photo-1571748982800-fa51082c2224?w=400&q=80", "prep_time": 15},
    {"id": "15", "name": "Pão de Queijo", "description": "Tradicional pão de queijo mineiro quentinho", "price": 8.00, "category": "Brunchs", "image_url": "https://images.unsplash.com/photo-1598142982903-df63877d3b93?w=400&q=80", "prep_time": 15},
    {"id": "16", "name": "Salgado", "description": "Salgado assado do dia", "price": 9.00, "category": "Brunchs", "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80", "prep_time": 15},
    
    # Toasts
    {"id": "17", "name": "Pão com Ovos", "description": "Pão integral, requeijão, ovos, mussarela e tomate", "price": 15.00, "category": "Toasts", "image_url": "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=400&q=80", "prep_time": 15},
    {"id": "18", "name": "Queijo Quente", "description": "Pão integral, mussarela, orégano e tomate", "price": 14.00, "category": "Toasts", "image_url": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80", "prep_time": 15},
    {"id": "19", "name": "Peito de Peru", "description": "Requeijão, peito de peru, mussarela, tomate e orégano", "price": 15.00, "category": "Toasts", "image_url": "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=400&q=80", "prep_time": 15},
    {"id": "20", "name": "Queijo Branco", "description": "Requeijão, queijo branco, tomate e orégano", "price": 16.00, "category": "Toasts", "image_url": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80", "prep_time": 15},
    {"id": "21", "name": "Queijo Branco e Peito de Peru", "description": "Requeijão, peito de peru, queijo branco, tomate e orégano", "price": 17.00, "category": "Toasts", "image_url": "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=400&q=80", "prep_time": 15},
    {"id": "22", "name": "Proteico Frango", "description": "Requeijão, frango, mussarela, tomate e orégano", "price": 18.00, "category": "Toasts", "image_url": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80", "prep_time": 15},
    {"id": "23", "name": "Proteico Atum", "description": "Requeijão, atum, mussarela, tomate e orégano", "price": 19.00, "category": "Toasts", "image_url": "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=400&q=80", "prep_time": 15},
    
    # Shakes Proteicos
    {"id": "24", "name": "Whey Morango com Água e Banana", "description": "Shake de whey sabor morango com água e banana", "price": 19.00, "category": "Shakes Proteicos", "image_url": "https://images.unsplash.com/photo-1552833266-62dedbacbc31?w=400", "prep_time": 15},
    {"id": "25", "name": "Whey Baunilha, Água, Mamão e Aveia", "description": "Shake de whey baunilha com mamão e aveia", "price": 23.00, "category": "Shakes Proteicos", "image_url": "https://images.unsplash.com/photo-1552833266-62dedbacbc31?w=400", "prep_time": 15},
    {"id": "26", "name": "Whey Baunilha, Água, Abacaxi e Mel", "description": "Shake de whey baunilha com abacaxi e mel", "price": 23.00, "category": "Shakes Proteicos", "image_url": "https://images.unsplash.com/photo-1552833266-62dedbacbc31?w=400", "prep_time": 15},
    {"id": "27", "name": "Whey Chocolate, Água, Banana e Paçoca", "description": "Shake de whey chocolate com banana e paçoca", "price": 22.00, "category": "Shakes Proteicos", "image_url": "https://images.unsplash.com/photo-1552833266-62dedbacbc31?w=400", "prep_time": 15},
    {"id": "28", "name": "Whey Morango, Leite e Banana", "description": "Shake cremoso de whey morango com leite e banana", "price": 22.00, "category": "Shakes Proteicos", "image_url": "https://images.unsplash.com/photo-1552833266-62dedbacbc31?w=400", "prep_time": 15},
    {"id": "29", "name": "Whey Baunilha, Leite, Banana e Mamão", "description": "Shake de whey baunilha com leite, banana e mamão", "price": 24.00, "category": "Shakes Proteicos", "image_url": "https://images.unsplash.com/photo-1552833266-62dedbacbc31?w=400", "prep_time": 15},
    {"id": "30", "name": "Whey Chocolate, Leite e Morango", "description": "Shake de whey chocolate com leite e morango", "price": 22.00, "category": "Shakes Proteicos", "image_url": "https://images.unsplash.com/photo-1552833266-62dedbacbc31?w=400", "prep_time": 15},
    {"id": "31", "name": "Whey Baunilha, Açaí, Morango e Banana", "description": "Shake especial com açaí, morango e banana", "price": 26.00, "category": "Shakes Proteicos", "image_url": "https://images.unsplash.com/photo-1552833266-62dedbacbc31?w=400", "prep_time": 15},
    
    # Açaí
    {"id": "32", "name": "Açaí Batido com Água", "description": "Açaí puro batido com água", "price": 16.00, "category": "Açaí", "image_url": "https://images.unsplash.com/photo-1602234382521-610b2abf9029?w=400", "prep_time": 15},
    {"id": "33", "name": "Açaí Batido com Leite", "description": "Açaí cremoso batido com leite", "price": 18.00, "category": "Açaí", "image_url": "https://images.unsplash.com/photo-1602234382521-610b2abf9029?w=400", "prep_time": 15},
    {"id": "34", "name": "Açaí Batido com Laranja", "description": "Açaí refrescante batido com suco de laranja", "price": 19.00, "category": "Açaí", "image_url": "https://images.unsplash.com/photo-1602234382521-610b2abf9029?w=400", "prep_time": 15},
    {"id": "35", "name": "Açaí Batido com Leite, Banana e Morango", "description": "Açaí cremoso com leite, banana e morango", "price": 21.00, "category": "Açaí", "image_url": "https://images.unsplash.com/photo-1602234382521-610b2abf9029?w=400", "prep_time": 15},
    {"id": "36", "name": "Açaí na Tigela 500ml", "description": "1 fruta + 3 adicionais (aveia, mel, granola, leite em pó ou leite condensado)", "price": 22.00, "category": "Açaí", "image_url": "https://images.unsplash.com/photo-1602234382521-610b2abf9029?w=400", "prep_time": 15},
    
    # Sucos e Vitaminas
    {"id": "37", "name": "Suco Natural de Laranja", "description": "Suco de laranja 100% natural", "price": 15.00, "category": "Sucos e Vitaminas", "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400", "prep_time": 15},
    {"id": "38", "name": "Suco Natural de Abacaxi", "description": "Suco de abacaxi fresco", "price": 14.00, "category": "Sucos e Vitaminas", "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400", "prep_time": 15},
    {"id": "39", "name": "Suco Natural de Manga", "description": "Suco de manga natural", "price": 14.00, "category": "Sucos e Vitaminas", "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400", "prep_time": 15},
    {"id": "40", "name": "Suco Natural de Morango e Laranja", "description": "Mix refrescante de morango com laranja", "price": 16.00, "category": "Sucos e Vitaminas", "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400", "prep_time": 15},
    {"id": "41", "name": "Suco Natural de Maracujá com Manga", "description": "Combinação tropical de maracujá com manga", "price": 16.00, "category": "Sucos e Vitaminas", "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400", "prep_time": 15},
    {"id": "42", "name": "Suco Detox", "description": "Abacaxi, hortelã, couve, gengibre e maçã. Adicione proteína por +R$11", "price": 15.00, "category": "Sucos e Vitaminas", "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400", "prep_time": 15},
    {"id": "43", "name": "Vitamina com Uma Fruta", "description": "Vitamina cremosa com a fruta de sua escolha", "price": 15.00, "category": "Sucos e Vitaminas", "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400", "prep_time": 15},
    {"id": "44", "name": "Vitamina com Duas Frutas", "description": "Vitamina cremosa com duas frutas de sua escolha", "price": 18.00, "category": "Sucos e Vitaminas", "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400", "prep_time": 15},
    
    # Saladas
    {"id": "45", "name": "Salada de Frutas", "description": "Mix de frutas frescas do dia", "price": 14.00, "category": "Saladas", "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400", "prep_time": 15},
    {"id": "46", "name": "Salada Simples", "description": "Alface, tomate e cenoura - acompanhamento perfeito", "price": 7.00, "category": "Saladas", "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400", "prep_time": 15},
    {"id": "47", "name": "Salada Ganoh", "description": "Alface, tomate, cenoura, queijo branco, frango ou atum, molho da casa e torradinhas", "price": 19.00, "category": "Saladas", "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400", "prep_time": 15},
    
    # Bebidas Quentes
    {"id": "48", "name": "Café Pequeno", "description": "Café coado tradicional", "price": 4.50, "category": "Bebidas Quentes", "image_url": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400", "prep_time": 15},
    {"id": "49", "name": "Café Grande", "description": "Café coado em porção generosa", "price": 6.00, "category": "Bebidas Quentes", "image_url": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400", "prep_time": 15},
    {"id": "50", "name": "Café com Leite", "description": "Café coado com leite vaporizado", "price": 7.00, "category": "Bebidas Quentes", "image_url": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400", "prep_time": 15},
    {"id": "51", "name": "Expresso", "description": "Café expresso encorpado", "price": 8.00, "category": "Bebidas Quentes", "image_url": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400", "prep_time": 15},
    {"id": "52", "name": "Chá", "description": "Chá quente - consulte sabores disponíveis", "price": 6.00, "category": "Bebidas Quentes", "image_url": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400", "prep_time": 15},
    {"id": "53", "name": "Capuccino / Mocaccino", "description": "Bebida cremosa com espuma de leite", "price": 9.00, "category": "Bebidas Quentes", "image_url": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400", "prep_time": 15},
    {"id": "54", "name": "Chocolate Quente", "description": "Chocolate cremoso e reconfortante", "price": 9.00, "category": "Bebidas Quentes", "image_url": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400", "prep_time": 15},
    
    # Bebidas Geladas
    {"id": "55", "name": "Água Pequena", "description": "Água mineral 300ml", "price": 5.00, "category": "Bebidas Geladas", "image_url": "https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400", "prep_time": 15},
    {"id": "56", "name": "Água Grande", "description": "Água mineral 500ml", "price": 8.00, "category": "Bebidas Geladas", "image_url": "https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400", "prep_time": 15},
    {"id": "57", "name": "H2O", "description": "Água saborizada", "price": 8.00, "category": "Bebidas Geladas", "image_url": "https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400", "prep_time": 15},
    {"id": "58", "name": "Gatorade", "description": "Isotônico para reposição", "price": 9.00, "category": "Bebidas Geladas", "image_url": "https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400", "prep_time": 15},
    {"id": "59", "name": "Energético Red Bull", "description": "Bebida energética", "price": 15.00, "category": "Bebidas Geladas", "image_url": "https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400", "prep_time": 15},
    {"id": "60", "name": "Energético Monster", "description": "Bebida energética", "price": 15.00, "category": "Bebidas Geladas", "image_url": "https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400", "prep_time": 15},
    {"id": "61", "name": "Mupy", "description": "Bebida láctea infantil", "price": 6.00, "category": "Bebidas Geladas", "image_url": "https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400", "prep_time": 15},
    {"id": "62", "name": "Kapo", "description": "Suco de caixinha", "price": 6.00, "category": "Bebidas Geladas", "image_url": "https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400", "prep_time": 15},
    {"id": "63", "name": "Toddynho", "description": "Achocolatado", "price": 6.00, "category": "Bebidas Geladas", "image_url": "https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400", "prep_time": 15},
    {"id": "64", "name": "Água de Coco Grande", "description": "Água de coco natural 500ml", "price": 8.00, "category": "Bebidas Geladas", "image_url": "https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400", "prep_time": 15},
    {"id": "65", "name": "Água de Coco Pequena", "description": "Água de coco natural 300ml", "price": 6.00, "category": "Bebidas Geladas", "image_url": "https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400", "prep_time": 15},
    {"id": "66", "name": "Coca-Cola Mini", "description": "Coca-Cola 200ml", "price": 3.50, "category": "Bebidas Geladas", "image_url": "https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400", "prep_time": 15},
    {"id": "67", "name": "Coca-Cola Lata", "description": "Coca-Cola 350ml", "price": 6.60, "category": "Bebidas Geladas", "image_url": "https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400", "prep_time": 15},
    
    # Suplementos
    {"id": "68", "name": "Creatina (1 dose)", "description": "Dose de creatina monohidratada", "price": 8.00, "category": "Suplementos", "image_url": "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400", "prep_time": 15},
    {"id": "69", "name": "Pré Treino (1 dose)", "description": "Dose de pré-treino para energia", "price": 9.00, "category": "Suplementos", "image_url": "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400", "prep_time": 15},
    {"id": "70", "name": "Dose de Whey (2 scoops)", "description": "Proteína whey isolada", "price": 13.00, "category": "Suplementos", "image_url": "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400", "prep_time": 15},
    {"id": "71", "name": "Carb Up", "description": "Carboidrato de rápida absorção", "price": 9.00, "category": "Suplementos", "image_url": "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400", "prep_time": 15},
    
    # Adicionais
    {"id": "72", "name": "Ovos (adicional)", "description": "Porção extra de ovos", "price": 3.50, "category": "Adicionais", "image_url": "https://images.unsplash.com/photo-1598142982901-df6cec090cef?w=400", "prep_time": 15},
    {"id": "73", "name": "Atum (adicional)", "description": "Porção extra de atum", "price": 7.00, "category": "Adicionais", "image_url": "https://images.unsplash.com/photo-1598142982901-df6cec090cef?w=400", "prep_time": 15},
    {"id": "74", "name": "Queijo Branco (adicional)", "description": "Porção extra de queijo branco", "price": 8.00, "category": "Adicionais", "image_url": "https://images.unsplash.com/photo-1598142982901-df6cec090cef?w=400", "prep_time": 15},
    {"id": "75", "name": "Mussarela (adicional)", "description": "Porção extra de mussarela", "price": 3.00, "category": "Adicionais", "image_url": "https://images.unsplash.com/photo-1598142982901-df6cec090cef?w=400", "prep_time": 15},
    {"id": "76", "name": "Frango (adicional)", "description": "Porção extra de frango desfiado", "price": 7.00, "category": "Adicionais", "image_url": "https://images.unsplash.com/photo-1598142982901-df6cec090cef?w=400", "prep_time": 15},
    {"id": "77", "name": "Mel (adicional)", "description": "Porção extra de mel", "price": 3.50, "category": "Adicionais", "image_url": "https://images.unsplash.com/photo-1598142982901-df6cec090cef?w=400", "prep_time": 15},
    {"id": "78", "name": "Granola (adicional)", "description": "Porção extra de granola", "price": 3.50, "category": "Adicionais", "image_url": "https://images.unsplash.com/photo-1598142982901-df6cec090cef?w=400", "prep_time": 15},
    {"id": "79", "name": "Nutella (adicional)", "description": "Porção extra de Nutella", "price": 5.00, "category": "Adicionais", "image_url": "https://images.unsplash.com/photo-1598142982901-df6cec090cef?w=400", "prep_time": 15},
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
    "Adicionais"
]

# Routes
@api_router.get("/")
async def root():
    return {"message": "GANOH Café Bistrô API"}

@api_router.get("/menu")
async def get_menu():
    return {"items": MENU_DATA, "categories": CATEGORIES}

@api_router.get("/menu/category/{category}")
async def get_menu_by_category(category: str):
    items = [item for item in MENU_DATA if item["category"] == category]
    return {"items": items, "category": category}

@api_router.get("/categories")
async def get_categories():
    return {"categories": CATEGORIES}

@api_router.post("/orders", response_model=Order)
async def create_order(order_input: OrderCreate):
    order = Order(
        customer_name=order_input.customer_name,
        items=order_input.items,
        total=order_input.total,
        prep_time=15
    )
    
    doc = order.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.orders.insert_one(doc)
    return order

@api_router.get("/orders")
async def get_orders(status: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for order in orders:
        if isinstance(order.get('created_at'), str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
        if isinstance(order.get('updated_at'), str):
            order['updated_at'] = datetime.fromisoformat(order['updated_at'])
    
    return {"orders": orders}

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    if isinstance(order.get('created_at'), str):
        order['created_at'] = datetime.fromisoformat(order['created_at'])
    if isinstance(order.get('updated_at'), str):
        order['updated_at'] = datetime.fromisoformat(order['updated_at'])
    
    return order

@api_router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, status_update: OrderStatusUpdate):
    result = await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "status": status_update.status.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    
    if isinstance(order.get('created_at'), str):
        order['created_at'] = datetime.fromisoformat(order['created_at'])
    if isinstance(order.get('updated_at'), str):
        order['updated_at'] = datetime.fromisoformat(order['updated_at'])
    
    return order

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    result = await db.orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return {"message": "Pedido removido com sucesso"}

# Kitchen stats
@api_router.get("/kitchen/stats")
async def get_kitchen_stats():
    pending = await db.orders.count_documents({"status": "received"})
    preparing = await db.orders.count_documents({"status": "preparing"})
    ready = await db.orders.count_documents({"status": "ready"})
    delivered = await db.orders.count_documents({"status": "delivered"})
    
    return {
        "pending": pending,
        "preparing": preparing,
        "ready": ready,
        "delivered": delivered,
        "total": pending + preparing + ready + delivered
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
