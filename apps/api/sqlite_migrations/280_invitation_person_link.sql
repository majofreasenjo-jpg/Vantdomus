-- CP1d-FAMILY-PILOT-1a: vínculo opcional invitación → persona del hogar.
-- Al aceptar la invitación, si person_id apunta a una persona del hogar sin
-- user_id, se enlaza persons.user_id con el usuario recién incorporado.
ALTER TABLE household_invitations ADD COLUMN person_id TEXT;
