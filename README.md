
# Projet : Système de Déploiement Optimisé de Drones

## 1.Contexte et Objectifs
Ce projet propose une solution logicielle pour optimiser et simuler le déploiement de drones de surveillance ou d'intervention dans une zone géographique dédiée. En fonction des paramètres de mission (météo, contraintes de terrain, portée du matériel), le système permet de discrétiser le territoire et de calculer le positionnement idéal des téléopérateurs et des drones.

## 2.Installation 
-npm ci

## 3.Algorithmes et Espace de Résolution
### 3.1 Maîtrise de l'Espace de Résolution (Discrétisation par Grille)
Plutôt que de résoudre le problème sur un espace continu infini, la zone de mission est échantillonnée sous forme d'une grille de points géographiques.

- Précision paramétrable : La distance entre deux points de la grille (precision en km) définit la résolution du problème.

- Respect du périmètre et zones privées : La grille filtre strictement les points situés à l'intérieur du polygone (booleanPointInPolygon).Ce choix simplifie l'intégration des contraintes du monde réel : il suffit d'exclure les points tombant dans des secteurs interdits ou privés.

- Répartition aléatoire : Les points de passage peuvent être mélangés via l'algorithme de Fisher-Yates pour optimiser les parcours d'exploration.
### 3.2. Algorithme de Couverture et Téléopérateurs
La résolution se déroule en deux étapes clés :
-Calcul du nombre minimal de téléopérateurs : Détermination du nombre de stations sol requis pour garantir une couverture à 100 % de la zone discrétisée en fonction de la portée radio/visuelle maximale des équipements.
-Simulation de la zone couverte réelle : En fixant un nombre donné de téléopérateurs et leur portée, l'algorithme calcule et affiche le taux de couverture effectif de la grille et identifie les zones d'ombre résiduelles.
