import { defineConfig } from 'vite';
import fs from 'fs';

export default defineConfig({
  plugins: [
    {
      name: 'sauvegarde-json-interne',
      configureServer(server) {
        // Cette route écoute quand l'application veut sauvegarder
        server.middlewares.use('/api/save-zones', (req, res) => {
          let body = '';
          // 1. Récupère les données envoyées par l'appli
          req.on('data', chunk => { body += chunk; });
          
          req.on('end', () => {
            // 2. Écrit silencieusement dans le fichier zones.json de votre PC !
            fs.writeFileSync('./data/zones.json', body);
            
            // 3. Répond à l'application que c'est un succès
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          });
        });
      }
    }
  ]
});