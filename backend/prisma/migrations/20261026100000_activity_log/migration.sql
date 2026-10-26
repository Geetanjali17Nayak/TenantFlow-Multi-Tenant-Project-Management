-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_entity_id_created_at_idx" ON "audit_logs"("tenant_id", "entity", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_user_id_created_at_idx" ON "audit_logs"("tenant_id", "user_id", "created_at");

