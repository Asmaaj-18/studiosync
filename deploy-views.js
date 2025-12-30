import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Pour les imports ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Types pour les résultats des vues
interface DatabaseView {
  view_name: string;
  table_schema: string;
}

interface ViewColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface ViewDefinition {
  name: string;
  definition: string;
  columns: ViewColumn[];
}

/**
 * Lit un fichier SQL
 */
async function readSqlFile(filePath: string): Promise<string> {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    return sql;
  } catch (error) {
    throw new Error(`Failed to read SQL file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Vérifie si une vue existe déjà
 */
async function viewExists(viewName: string): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = ${viewName.toLowerCase()}
      );
    `;
    return result[0]?.exists || false;
  } catch (error) {
    console.error(`Error checking if view ${viewName} exists:`, error);
    return false;
  }
}

/**
 * Supprime une vue si elle existe
 */
async function dropViewIfExists(viewName: string): Promise<void> {
  try {
    const exists = await viewExists(viewName);
    if (exists) {
      console.log(`🗑️  Dropping existing view: ${viewName}`);
      await prisma.$executeRawUnsafe(`DROP VIEW IF EXISTS "${viewName}" CASCADE;`);
    }
  } catch (error) {
    console.error(`Error dropping view ${viewName}:`, error);
  }
}

/**
 * Récupère les informations sur les colonnes d'une vue
 */
async function getViewColumns(viewName: string): Promise<ViewColumn[]> {
  try {
    const columns = await prisma.$queryRaw<ViewColumn[]>`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${viewName.toLowerCase()}
      ORDER BY ordinal_position;
    `;
    return columns;
  } catch (error) {
    console.error(`Error getting columns for view ${viewName}:`, error);
    return [];
  }
}

/**
 * Récupère la définition d'une vue
 */
async function getViewDefinition(viewName: string): Promise<string> {
  try {
    const result = await prisma.$queryRaw<Array<{ definition: string }>>`
      SELECT pg_get_viewdef(${viewName}, true) as definition;
    `;
    return result[0]?.definition || '';
  } catch (error) {
    console.error(`Error getting definition for view ${viewName}:`, error);
    return '';
  }
}

/**
 * Déploie une seule vue depuis un fichier SQL
 */
async function deployView(viewName: string, sqlContent: string): Promise<boolean> {
  try {
    console.log(`📝 Creating view: ${viewName}`);
    
    // Supprimer la vue existante si elle existe
    await dropViewIfExists(viewName);
    
    // Créer la nouvelle vue
    await prisma.$executeRawUnsafe(sqlContent);
    
    // Vérifier que la vue a été créée
    const created = await viewExists(viewName);
    if (created) {
      console.log(`✅ View ${viewName} created successfully`);
      
      // Afficher les informations sur la vue
      const columns = await getViewColumns(viewName);
      console.log(`   Columns: ${columns.map(c => c.column_name).join(', ')}`);
      
      return true;
    } else {
      console.error(`❌ Failed to create view ${viewName}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error creating view ${viewName}:`, error);
    return false;
  }
}

/**
 * Liste toutes les vues disponibles dans la base de données
 */
async function listAllViews(): Promise<DatabaseView[]> {
  try {
    const views = await prisma.$queryRaw<DatabaseView[]>`
      SELECT 
        table_name as view_name,
        table_schema
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    return views;
  } catch (error) {
    console.error('Error listing views:', error);
    return [];
  }
}

/**
 * Vérifie la santé des vues
 */
async function checkViewsHealth(): Promise<{
  total: number;
  healthy: number;
  views: Array<{
    name: string;
    status: 'healthy' | 'error';
    error?: string;
  }>;
}> {
  const views = await listAllViews();
  const results = [];

  for (const view of views) {
    try {
      // Essayer de sélectionner une ligne de la vue
      await prisma.$queryRawUnsafe(`SELECT 1 FROM "${view.view_name}" LIMIT 1;`);
      results.push({
        name: view.view_name,
        status: 'healthy' as const
      });
    } catch (error) {
      results.push({
        name: view.view_name,
        status: 'error' as const,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return {
    total: views.length,
    healthy: results.filter(r => r.status === 'healthy').length,
    views: results
  };
}

/**
 * Déploie toutes les vues depuis un fichier SQL
 */
async function deployAllViews(): Promise<void> {
  console.log('🚀 Déploiement des vues sur la base de données...');
  
  try {
    // Vérifier la connexion à la base de données
    await prisma.$connect();
    console.log('✅ Connected to database');
    
    // Chemin vers le fichier SQL des vues
    const sqlPath = path.join(__dirname, '..', 'prisma', 'neon-views.sql');
    
    // Vérifier si le fichier existe
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL file not found: ${sqlPath}`);
    }
    
    console.log(`📄 Reading SQL file: ${sqlPath}`);
    
    // Lire le fichier SQL
    const sqlContent = await readSqlFile(sqlPath);
    
    // Séparer les instructions SQL (suppose que chaque instruction se termine par ;)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`📊 Found ${statements.length} SQL statements`);
    
    // Compter les vues à créer
    const viewStatements = statements.filter(stmt => 
      stmt.toLowerCase().includes('create view') || 
      stmt.toLowerCase().includes('create or replace view')
    );
    
    console.log(`👁️  Found ${viewStatements.length} view definitions`);
    
    // Exécuter chaque instruction
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      try {
        // Extraire le nom de la vue si c'est une instruction CREATE VIEW
        const viewMatch = statement.match(/create\s+(?:or\s+replace\s+)?view\s+(\w+)/i);
        const viewName = viewMatch ? viewMatch[1] : null;
        
        if (viewName) {
          // Déployer la vue individuellement
          const success = await deployView(viewName, statement + ';');
          if (success) {
            successCount++;
          } else {
            errorCount++;
          }
        } else {
          // Exécuter les autres instructions SQL (index, etc.)
          console.log('⚙️  Executing non-view statement');
          await prisma.$executeRawUnsafe(statement + ';');
        }
      } catch (error) {
        console.error('❌ Error executing SQL statement:', error);
        errorCount++;
      }
    }
    
    // Afficher le résumé
    console.log('\n📊 Déploiement terminé:');
    console.log(`   ✅ Succès: ${successCount}`);
    console.log(`   ❌ Échecs: ${errorCount}`);
    
    if (successCount > 0) {
      // Lister les vues disponibles
      const views = await listAllViews();
      console.log('\n📋 Vues disponibles dans la base de données:');
      views.forEach((view, index) => {
        console.log(`   ${index + 1}. ${view.view_name}`);
      });
      
      // Vérifier la santé des vues
      console.log('\n🏥 Vérification de la santé des vues...');
      const health = await checkViewsHealth();
      console.log(`   Total: ${health.total}`);
      console.log(`   Saines: ${health.healthy}`);
      
      if (health.healthy < health.total) {
        console.log('\n⚠️  Certaines vues ont des problèmes:');
        health.views
          .filter(v => v.status === 'error')
          .forEach(v => {
            console.log(`   - ${v.name}: ${v.error}`);
          });
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du déploiement:', error);
    throw error;
  }
}

/**
 * Fonction principale
 */
async function main(): Promise<void> {
  const startTime = Date.now();
  
  try {
    console.log('='.repeat(60));
    console.log('🏗️  StudioSync - Déploiement des vues SQL');
    console.log('='.repeat(60));
    
    // Déployer toutes les vues
    await deployAllViews();
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n⏱️  Temps d'exécution: ${duration.toFixed(2)} secondes`);
    console.log('✅ Script terminé avec succès!');
    
  } catch (error) {
    console.error('❌ Script échoué:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exporter les fonctions pour les tests
export {
  deployAllViews,
  deployView,
  viewExists,
  dropViewIfExists,
  listAllViews,
  checkViewsHealth,
  readSqlFile
};

// Exécuter le script si c'est le fichier principal
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}