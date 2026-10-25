-- =====================================================
-- JOB BOARD : base de données complète (SQLite)
-- =====================================================
-- ATTENTION : les DROP TABLE ci-dessous EFFACENT les tables.
-- Ne lance ce fichier que pour (re)créer une base de zéro.
-- =====================================================

DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS ads;
DROP TABLE IF EXISTS people;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS companies;

-- ---------- 1. LES TABLES ----------

-- Entreprises qui publient des annonces
CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

-- Catégories d'annonces (Design, Développement...)
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

-- Annonces d'emploi
CREATE TABLE ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  company_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  salary TEXT,
  location TEXT,
  working_time TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Personnes (candidats et administrateurs)
CREATE TABLE people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user'
);

-- Un email = un seul compte
CREATE UNIQUE INDEX idx_people_email ON people(email);

-- Candidatures : quelle personne a postulé à quelle annonce
CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  ad_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  FOREIGN KEY (person_id) REFERENCES people(id),
  FOREIGN KEY (ad_id) REFERENCES ads(id)
);

-- ---------- 2. LES DONNÉES DE TEST ----------

INSERT INTO companies (name) VALUES
  ('Acme'),
  ('Militech');

INSERT INTO categories (name) VALUES
  ('Design'),
  ('Développement');

INSERT INTO people (name, email) VALUES
  ('Jacob', 'jacob@mail.com'),
  ('Yanice', 'yanice@mail.com'),
  ('Francis', 'francis@mail.com');

INSERT INTO ads (title, description, company_id, category_id, salary, location, working_time) VALUES
  ('UI Designer', 'Création des maquettes de notre application', 1, 1, '37 000 € / an', 'Paris', 'Temps plein'),
  ('Développeur web', 'Développement du site avec HTML, CSS et JavaScript', 1, 2, '40 000 € / an', 'Lyon', 'Temps plein'),
  ('Développeur Python', 'Création des outils internes en Python', 2, 2, '1 200 € / mois', 'Remote', 'Alternance'),
  ('Designer UX', 'Concevoir des parcours utilisateurs pour une application mobile.', 1, 1, '38 000 € / an', 'Paris', 'Temps plein'),
  ('Graphiste', 'Créer les visuels et supports de communication de la marque.', 2, 1, '32 000 € / an', 'Lyon', 'Temps plein'),
  ('Motion Designer', 'Réaliser des animations pour les réseaux sociaux.', 1, 1, '1 100 € / mois', 'Paris', 'Alternance'),
  ('Directeur artistique junior', 'Accompagner la direction artistique des campagnes.', 2, 1, '35 000 € / an', 'Remote', 'Temps plein'),
  ('Développeur front-end', 'Développer des interfaces en HTML, CSS et JavaScript.', 1, 2, '40 000 € / an', 'Paris', 'Temps plein'),
  ('Développeur back-end Node.js', 'Créer des API REST avec Node.js et Express.', 2, 2, '42 000 € / an', 'Lyon', 'Temps plein'),
  ('Développeur full-stack', 'Travailler sur le front et le back d''une plateforme web.', 1, 2, '45 000 € / an', 'Remote', 'Temps plein'),
  ('Stagiaire développeur', 'Participer au développement d''une application interne.', 2, 2, '900 € / mois', 'Paris', 'Stage'),
  ('Développeur PHP', 'Maintenir et faire évoluer un site e-commerce.', 1, 2, '38 000 € / an', 'Lille', 'Temps plein'),
  ('Alternant développeur web', 'Rejoindre l''équipe produit en alternance.', 2, 2, '1 200 € / mois', 'Paris', 'Alternance'),
  ('Intégrateur web', 'Intégrer des maquettes Figma en HTML et CSS.', 1, 1, '34 000 € / an', 'Remote', 'Temps partiel'),
  ('Ingénieur DevOps', 'Automatiser les déploiements et surveiller les serveurs.', 2, 2, '50 000 € / an', 'Lyon', 'Temps plein');

INSERT INTO applications (person_id, ad_id, message, applied_at) VALUES
  (1, 1, 'Bonjour, je suis intéressé par ce poste de designer.', '2026-10-01'),
  (2, 1, 'Je candidate avec plaisir, mon portfolio est en ligne.', '2026-10-02'),
  (2, 2, 'Le développement web m''intéresse beaucoup.', '2026-10-03'),
  (3, 3, 'Je maîtrise Python, voici ma candidature.', '2026-10-04'),
  (2, 3, 'Je suis très motivé pour ce poste.', '2026-10-06');