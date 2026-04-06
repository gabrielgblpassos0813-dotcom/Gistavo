"""Prazo (Credit/Tab) Routes - Customer debts, payments, and credit management"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging

router = APIRouter(prefix="/prazo", tags=["Prazo"])
logger = logging.getLogger(__name__)

# Will be set by main app
db = None
PRAZO_PASSWORD = "1234"
send_whatsapp_message = None

def set_dependencies(database, password, whatsapp_func=None):
    global db, PRAZO_PASSWORD, send_whatsapp_message
    db = database
    PRAZO_PASSWORD = password
    send_whatsapp_message = whatsapp_func

# ==================== MODELS ====================

class PrazoCustomerCreate(BaseModel):
    name: str
    phone: str = ""
    notes: str = ""
    store: str = "runner"
    credit: float = 0

class PrazoPayment(BaseModel):
    password: str
    amount: float = 0
    payment_method: str = "cash"

class PrazoCreditAdd(BaseModel):
    amount: float
    notes: str = ""

class PrazoAbaterRequest(BaseModel):
    password: str
    amount: float
    payment_method: str = "cash"

# ==================== CUSTOMER ROUTES ====================

@router.get("/customers")
async def get_prazo_customers(store: str = None):
    """Get all registered prazo customers, optionally filtered by store"""
    query = {}
    if store:
        query["store"] = store
    customers = await db.prazo_customers.find(query, {"_id": 0}).to_list(500)
    return {"customers": customers}

@router.post("/customers")
async def create_prazo_customer(customer: PrazoCustomerCreate):
    """Register a new prazo customer"""
    existing = await db.prazo_customers.find_one({
        "name": {"$regex": f"^{customer.name}$", "$options": "i"},
        "store": customer.store
    })
    if existing:
        raise HTTPException(status_code=400, detail="Cliente já cadastrado nesta loja")
    
    new_customer = {
        "id": str(uuid.uuid4()),
        "name": customer.name,
        "phone": customer.phone,
        "notes": customer.notes,
        "store": customer.store,
        "credit": customer.credit,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.prazo_customers.insert_one(new_customer)
    return {**new_customer, "_id": None}

@router.delete("/customers/{customer_id}")
async def delete_prazo_customer(customer_id: str):
    """Delete a prazo customer"""
    result = await db.prazo_customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return {"success": True, "message": "Cliente removido"}

@router.put("/customers/{customer_id}")
async def update_prazo_customer(customer_id: str, data: dict):
    """Update prazo customer information"""
    update_data = {}
    if "name" in data and data["name"]:
        update_data["name"] = data["name"]
    if "phone" in data:
        update_data["phone"] = data["phone"]
    if "notes" in data:
        update_data["notes"] = data["notes"]
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum dado para atualizar")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.prazo_customers.update_one(
        {"id": customer_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    return {"success": True, "message": "Cliente atualizado"}

# ==================== CREDIT ROUTES ====================

@router.post("/customers/{customer_id}/add-credit")
async def add_prazo_credit(customer_id: str, credit_data: PrazoCreditAdd):
    """Add credit to a prazo customer's account"""
    customer = await db.prazo_customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    current_credit = customer.get("credit", 0)
    new_credit = current_credit + credit_data.amount
    
    await db.prazo_customers.update_one(
        {"id": customer_id},
        {"$set": {"credit": new_credit}}
    )
    
    return {
        "success": True, 
        "message": f"Crédito adicionado! Saldo: R$ {new_credit:.2f}",
        "previous_credit": current_credit,
        "added": credit_data.amount,
        "new_credit": new_credit
    }

@router.post("/customers/{customer_id}/use-credit")
async def use_prazo_credit(customer_id: str, credit_data: PrazoCreditAdd):
    """Use credit from a prazo customer's account"""
    customer = await db.prazo_customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    current_credit = customer.get("credit", 0)
    if credit_data.amount > current_credit:
        raise HTTPException(status_code=400, detail=f"Crédito insuficiente. Saldo: R$ {current_credit:.2f}")
    
    new_credit = current_credit - credit_data.amount
    
    await db.prazo_customers.update_one(
        {"id": customer_id},
        {"$set": {"credit": new_credit}}
    )
    
    return {
        "success": True, 
        "message": f"Crédito utilizado! Novo saldo: R$ {new_credit:.2f}",
        "previous_credit": current_credit,
        "used": credit_data.amount,
        "new_credit": new_credit
    }

# ==================== DEBT ROUTES ====================

@router.get("/debts")
async def get_prazo_debts(store: Optional[str] = None):
    """Get prazo debts summary - optionally filtered by store"""
    query = {
        "payment_method": "prazo",
        "prazo_paid": {"$ne": True}
    }
    if store:
        query["store"] = store
    
    prazo_orders = await db.orders.find(query, {"_id": 0}).to_list(1000)
    
    prazo_customers = await db.prazo_customers.find({}, {"_id": 0, "name": 1, "phone": 1}).to_list(1000)
    customer_phones = {c.get("name", "").lower(): c.get("phone", "") for c in prazo_customers}
    
    debts_by_customer = {}
    for order in prazo_orders:
        name = order.get("customer_name", "Desconhecido")
        order_store = order.get("store", "")
        order_total = order.get("total", 0)
        partial_paid = order.get("partial_paid", 0)
        remaining = order_total - partial_paid
        
        if remaining <= 0:
            continue
        
        if name not in debts_by_customer:
            phone = customer_phones.get(name.lower(), "")
            debts_by_customer[name] = {"name": name, "total": 0, "orders": [], "order_count": 0, "store": order_store, "phone": phone}
        debts_by_customer[name]["total"] += remaining
        debts_by_customer[name]["order_count"] += 1
        debts_by_customer[name]["orders"].append({
            "id": order.get("id"),
            "total": order_total,
            "partial_paid": partial_paid,
            "remaining": remaining,
            "date": order.get("created_at"),
            "items": order.get("items", []),
            "store": order_store
        })
    
    debts = sorted(debts_by_customer.values(), key=lambda x: x["total"], reverse=True)
    total_prazo = sum(d["total"] for d in debts)
    
    return {
        "debts": debts,
        "total_prazo": total_prazo,
        "customer_count": len(debts),
        "store_filter": store or "all"
    }

# ==================== PAYMENT ROUTES ====================

@router.post("/pay/{order_id}")
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

@router.post("/pay-all/{customer_name}")
async def pay_all_prazo_customer(customer_name: str, payment: PrazoPayment):
    """Mark all prazo orders for a customer as paid (requires password)"""
    if payment.password != PRAZO_PASSWORD:
        raise HTTPException(status_code=403, detail="Senha incorreta")
    
    first_order = await db.orders.find_one(
        {"customer_name": customer_name, "payment_method": "prazo", "prazo_paid": {"$ne": True}},
        {"store": 1}
    )
    customer_store = first_order.get("store", "runner") if first_order else "runner"
    
    result = await db.orders.update_many(
        {"customer_name": customer_name, "payment_method": "prazo", "prazo_paid": {"$ne": True}},
        {"$set": {
            "prazo_paid": True, 
            "prazo_paid_at": datetime.now(timezone.utc).isoformat(),
            "prazo_paid_method": payment.payment_method
        }}
    )
    
    payment_record = {
        "id": str(uuid.uuid4()),
        "customer_name": customer_name,
        "amount": payment.amount,
        "payment_method": payment.payment_method,
        "type": "full_payment",
        "store": customer_store,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.prazo_payments.insert_one(payment_record)
    
    return {"success": True, "message": f"Todos os débitos de {customer_name} foram quitados ({payment.payment_method})", "orders_paid": result.modified_count}

@router.post("/abater/{customer_name}")
async def abater_prazo_debt(customer_name: str, abater_data: PrazoAbaterRequest):
    """
    Abater (partial payment) on a prazo customer's debt.
    This reduces the total debt by the specified amount.
    If the customer has credit, it will be reduced by the payment amount.
    """
    if abater_data.password != PRAZO_PASSWORD:
        raise HTTPException(status_code=403, detail="Senha incorreta")
    
    prazo_orders = await db.orders.find({
        "customer_name": {"$regex": f"^{customer_name}$", "$options": "i"},
        "payment_method": "prazo",
        "prazo_paid": {"$ne": True}
    }, {"_id": 0}).sort("created_at", 1).to_list(1000)
    
    if not prazo_orders:
        raise HTTPException(status_code=404, detail="Cliente não tem dívidas no prazo")
    
    total_debt = sum(o.get("total", 0) - o.get("partial_paid", 0) for o in prazo_orders)
    
    if abater_data.amount > total_debt:
        raise HTTPException(status_code=400, detail=f"Valor maior que a dívida total (R$ {total_debt:.2f})")
    
    remaining_to_apply = abater_data.amount
    orders_updated = 0
    orders_fully_paid = 0
    customer_store = prazo_orders[0].get("store", "runner") if prazo_orders else "runner"
    
    # Check if customer has credit and reduce it
    customer = await db.prazo_customers.find_one({
        "name": {"$regex": f"^{customer_name}$", "$options": "i"}
    })
    
    previous_credit = 0
    new_credit = 0
    credit_used = 0
    
    if customer and customer.get("credit", 0) > 0:
        previous_credit = customer.get("credit", 0)
        # Reduce credit by the payment amount
        credit_used = min(abater_data.amount, previous_credit)
        new_credit = previous_credit - credit_used
        
        await db.prazo_customers.update_one(
            {"id": customer["id"]},
            {"$set": {"credit": new_credit}}
        )
    
    for order in prazo_orders:
        if remaining_to_apply <= 0:
            break
        
        order_total = order.get("total", 0)
        current_partial = order.get("partial_paid", 0)
        order_remaining = order_total - current_partial
        
        if order_remaining <= 0:
            continue
        
        amount_to_apply = min(remaining_to_apply, order_remaining)
        new_partial = current_partial + amount_to_apply
        
        if new_partial >= order_total:
            await db.orders.update_one(
                {"id": order["id"]},
                {"$set": {
                    "partial_paid": new_partial,
                    "prazo_paid": True,
                    "prazo_paid_at": datetime.now(timezone.utc).isoformat(),
                    "prazo_paid_method": abater_data.payment_method
                }}
            )
            orders_fully_paid += 1
        else:
            await db.orders.update_one(
                {"id": order["id"]},
                {"$set": {"partial_paid": new_partial}}
            )
        
        orders_updated += 1
        remaining_to_apply -= amount_to_apply
    
    payment_record = {
        "id": str(uuid.uuid4()),
        "customer_name": customer_name,
        "amount": abater_data.amount,
        "payment_method": abater_data.payment_method,
        "type": "partial_payment",
        "store": customer_store,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.prazo_partial_payments.insert_one(payment_record)
    
    new_total_debt = total_debt - abater_data.amount
    
    response = {
        "success": True,
        "message": f"Abatido R$ {abater_data.amount:.2f} da dívida de {customer_name}",
        "previous_debt": total_debt,
        "amount_paid": abater_data.amount,
        "new_debt": new_total_debt,
        "payment_method": abater_data.payment_method,
        "orders_updated": orders_updated,
        "orders_fully_paid": orders_fully_paid
    }
    
    # Add credit info if customer had credit
    if credit_used > 0:
        response["credit_used"] = credit_used
        response["previous_credit"] = previous_credit
        response["new_credit"] = new_credit
        response["message"] = f"Abatido R$ {abater_data.amount:.2f} da dívida de {customer_name}. Crédito atualizado: R$ {previous_credit:.2f} → R$ {new_credit:.2f}"
    
    return response

@router.delete("/debt/{customer_name}")
async def delete_prazo_debt(customer_name: str, password: str = None):
    """Delete/clear all prazo debts for a customer (marks as paid without recording payment)"""
    if password != PRAZO_PASSWORD:
        raise HTTPException(status_code=403, detail="Senha incorreta")
    
    result = await db.orders.update_many(
        {"customer_name": customer_name, "payment_method": "prazo", "prazo_paid": {"$ne": True}},
        {"$set": {"prazo_paid": True, "prazo_paid_at": datetime.now(timezone.utc).isoformat(), "prazo_cleared": True}}
    )
    
    return {
        "success": True,
        "message": f"Dívida de {customer_name} zerada",
        "orders_cleared": result.modified_count
    }

@router.delete("/debt-order/{order_id}")
async def delete_single_prazo_debt(order_id: str, password: str = None):
    """Delete/clear a single prazo debt order"""
    if password != PRAZO_PASSWORD:
        raise HTTPException(status_code=403, detail="Senha incorreta")
    
    result = await db.orders.update_one(
        {"id": order_id, "payment_method": "prazo", "prazo_paid": {"$ne": True}},
        {"$set": {"prazo_paid": True, "prazo_paid_at": datetime.now(timezone.utc).isoformat(), "prazo_cleared": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pedido não encontrado ou já pago")
    
    return {"success": True, "message": "Dívida apagada"}

# ==================== HISTORY ROUTES ====================

@router.get("/payments-history")
async def get_prazo_payments_history(store: str = None, limit: int = 100):
    """Get history of prazo payments (full and partial)"""
    query = {}
    if store:
        query["store"] = store
    
    full_payments = await db.prazo_payments.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    partial_payments = await db.prazo_partial_payments.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    all_payments = full_payments + partial_payments
    all_payments.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    totals = {"cash": 0, "pix": 0, "debit": 0, "credit": 0}
    for p in all_payments:
        method = p.get("payment_method", "cash")
        if method in totals:
            totals[method] += p.get("amount", 0)
    
    return {
        "payments": all_payments[:limit],
        "total_count": len(all_payments),
        "totals_by_method": totals,
        "grand_total": sum(totals.values())
    }
