// deploy-views.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function deployViews() {
  try {
    console.log('🚀 Déploiement des vues sur Neon...');
    
    // Lit le fichier SQL
    const sqlPath = path.join(__dirname, 'prisma', 'neon-views.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Exécute les vues
    await prisma.$executeRawUnsafe(sql);
    
    console.log('✅ Vues créées avec succès!');
    
    // Vérifie les vues
    const views = await prisma.$queryRaw`
      SELECT table_name as view_name
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    console.log('\n📋 Vues disponibles:');
    views.forEach(v => console.log(`  - ${v.view_name}`));
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

deployViews();