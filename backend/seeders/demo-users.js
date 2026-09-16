require('dotenv').config();
const sequelize = require('../src/config/database');
const User = require('../src/models/User');
const { hashPassword } = require('../src/services/auth.service');

const demoUsers = [
  {
    name: 'Admin Demo',
    email: 'admin@demo.com',
    password: 'Admin123!',
    role: 'ADMIN',
  },
  {
    name: 'User Demo',
    email: 'user@demo.com',
    password: 'User123!',
    role: 'USER',
  },
];

async function seed() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    for (const demo of demoUsers) {
      const existing = await User.findOne({ where: { email: demo.email } });

      if (existing) {
        console.log(`Usuario ${demo.email} ya existe, se omite.`);
        continue;
      }

      const hashed = await hashPassword(demo.password);

      await User.create({
        name: demo.name,
        email: demo.email,
        password: hashed,
        role: demo.role,
        is_active: true,
      });

      console.log(`Usuario ${demo.email} creado.`);
    }

    console.log('Seed completado.');
    process.exit(0);
  } catch (error) {
    console.error('Error en seed:', error.message);
    process.exit(1);
  }
}

seed();
