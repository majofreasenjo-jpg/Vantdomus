-- R31 SAFE ROLLBACK: revoke runtime access but NEVER disable RLS/FORCE.
-- Requires the original 57-table schema and a privileged isolated migration
-- connection. Purpose is to stop an unsafe pilot, not restore public access.
REVOKE ALL ON public.households,public.household_memberships,
 public.persons,public.memory_items FROM domi_app_runtime;
REVOKE EXECUTE ON FUNCTION domi_r31.subject_id() FROM domi_app_runtime;
REVOKE EXECUTE ON FUNCTION domi_r31.household_ok(text,text) FROM domi_app_runtime;
DROP POLICY IF EXISTS domi_r31_households_read ON public.households;
DROP POLICY IF EXISTS domi_r31_memberships_self ON public.household_memberships;
DROP POLICY IF EXISTS domi_r31_person_self ON public.persons;
DROP POLICY IF EXISTS domi_r31_memory_self_read ON public.memory_items;
DROP POLICY IF EXISTS domi_r31_memory_self_insert ON public.memory_items;
DROP POLICY IF EXISTS domi_r31_memory_self_update ON public.memory_items;
CREATE POLICY domi_r31_closed ON public.households FOR ALL
 TO domi_app_runtime USING (false) WITH CHECK (false);
CREATE POLICY domi_r31_closed ON public.household_memberships FOR ALL
 TO domi_app_runtime USING (false) WITH CHECK (false);
CREATE POLICY domi_r31_closed ON public.persons FOR ALL
 TO domi_app_runtime USING (false) WITH CHECK (false);
CREATE POLICY domi_r31_closed ON public.memory_items FOR ALL
 TO domi_app_runtime USING (false) WITH CHECK (false);
-- All 57 stay under FORCE RLS. Rollback is intentionally fail closed.
