import bcrypt from "bcrypt";
import { prisma } from "../src/config/database";

async function main() {
  const email = "admin@example.com";
  const password = "Admin123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "SUPER_ADMIN",
        name: "Super Admin",
      },
    });
    console.log("Seeded super admin:", email, password);
  } else {
    console.log("Super admin already exists:", email);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
