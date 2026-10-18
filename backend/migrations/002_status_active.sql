-- O contrato com o frontend usa os status "active" | "error" (antes gravávamos "ok").
UPDATE feeds SET status = 'active' WHERE status = 'ok';
