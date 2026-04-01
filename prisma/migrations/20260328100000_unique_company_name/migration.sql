-- AddUniqueIndex on Company.name (plain)
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- AddUniqueIndex on LOWER(name) so 'Bybid9' and 'bybid9' cannot coexist
CREATE UNIQUE INDEX "Company_name_lower_key" ON "Company"(LOWER("name"));
