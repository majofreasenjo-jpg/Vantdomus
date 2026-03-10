import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function hackHousehold() {
    const userId = "44698693-10c8-4e0c-9289-1f7817edc943"; // demo user
    const householdId = "288e2700-07df-4217-993a-3a4087ac3657"; // VantDomus Alpha

    try {
        console.log("Comprobando Prisma...");
        const existing = await prisma.householdMembership.findUnique({
            where: {
                household_id_user_id: { household_id: householdId, user_id: userId }
            }
        });

        if (existing) {
            console.log("Actualizando rol a Owner...");
            await prisma.householdMembership.update({
                where: { household_id_user_id: { household_id: householdId, user_id: userId } },
                data: { role: 'owner' }
            });
        } else {
            console.log("Insertando rol Owner...");
            await prisma.householdMembership.create({
                data: {
                    household_id: householdId,
                    user_id: userId,
                    role: 'owner'
                }
            });
        }
        console.log("¡Membresía inyectada correctamente!");
    } catch (error) {
        console.error("Error catastrófico Prisma:", error);
    } finally {
        await prisma.$disconnect();
    }
}

hackHousehold();
