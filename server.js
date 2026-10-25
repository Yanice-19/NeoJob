// ---- 1. les modules ----

const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const multer = require("multer");
const path = require("path");

// multer : range les CV envoyés dans public/uploads (nom unique avec la date)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "public", "uploads"));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + "-" + file.originalname);
    }
});
const upload = multer({ storage: storage });

// ---- 2. mise en place ----

const app = express();
const db = new Database("jobboard.db");

// ajoute la colonne cv_url dans applications (ignoré si elle existe déjà)
try {
    db.prepare("ALTER TABLE applications ADD COLUMN cv_url TEXT").run();
} catch (e) {
    // La colonne existe déjà
}

// pour lire le json et les formulaires envoyés par le front
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// sessions : le serveur retient qui est connecté grâce à un cookie
app.use(
    session({
        secret: process.env.SESSION_SECRET || "jobboard-secret-a-changer",
        resave: false,
        saveUninitialized: false,
    })
);

// sert les pages du dossier public
app.use(express.static("public"));

// droits : tout est réservé aux admins sauf les routes publiques
function exigerAdmin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: "Non connecté" });
    }
    if (req.session.user.role !== "admin") {
        return res.status(403).json({ error: "Réservé aux administrateurs" });
    }
    next();
}

app.use((req, res, next) => {
    const p = req.path;
    const m = req.method;
    // connexion / inscription / compte
    if (p.startsWith("/auth")) return next();
    // lecture publique des annonces, entreprises, catégories et villes
    if (m === "GET" && /^\/(ads|companies|categories|locations)(\/\d+(\/ads)?)?$/.test(p)) return next();
    // postuler à une annonce
    if (m === "POST" && /^\/ads\/\d+\/applications$/.test(p)) return next();
    // le reste : admin seulement
    return exigerAdmin(req, res, next);
});

// ---- 3. routes ----

// villes disponibles, pour le filtre de l'accueil
app.get("/locations", (req, res) => {
    const locations = db.prepare("SELECT DISTINCT location FROM ads WHERE location IS NOT NULL AND location != ''").all();
    res.json(locations.map(l => l.location));
});

// ---- annonces ----

// toutes les annonces
app.get("/ads", (req, res) => {
    const ads = db.prepare("SELECT * FROM ads").all();
    res.json(ads);
});

// une annonce avec le nom de son entreprise et de sa catégorie
app.get("/ads/:id", (req, res) => {
    const ad = db
        .prepare(
            `SELECT ads.*, companies.name AS company_name, categories.name AS category_name
            FROM ads
            JOIN companies ON ads.company_id = companies.id
            JOIN categories ON ads.category_id = categories.id
            WHERE ads.id = ?`
        )
        .get(req.params.id);
    if (!ad) {
        return res.status(404).json({ error: "Annonce introuvable" });
    }
    res.json(ad);
});

// créer une annonce (400 si un champ manque ou si l'id n'existe pas)
app.post("/ads", (req, res) => {
    const {
        title,
        description,
        company_id,
        category_id,
        salary,
        location,
        working_time,
    } = req.body;
    if (!title || !description || !company_id || !category_id) {
        return res.status(400).json({ error: "Champ obligatoire manquant" });
    }
    try {
        const result = db
            .prepare(
                "INSERT INTO ads (title, description, company_id, category_id, salary, location, working_time) VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
            .run(
                title,
                description,
                company_id,
                category_id,
                salary,
                location,
                working_time
            );
        res.status(201).json({ id: result.lastInsertRowid });
    } catch (err) {
        if (err.code === "SQLITE_CONSTRAINT_FOREIGNKEY" || err.message.includes("FOREIGN KEY")) {
            return res.status(400).json({ error: "L'ID entreprise ou l'ID catégorie renseigné n'existe pas." });
        }
        res.status(500).json({ error: "Erreur serveur : " + err.message });
    }
});

// modifier une annonce (ce qui n'est pas envoyé garde l'ancienne valeur)
app.put("/ads/:id", (req, res) => {
    const ad = db.prepare("SELECT * FROM ads WHERE id = ?").get(req.params.id);
    if (!ad) {
        return res.status(404).json({ error: "Annonce introuvable" });
    }
    const {
        title = ad.title,
        description = ad.description,
        company_id = ad.company_id,
        category_id = ad.category_id,
        salary = ad.salary,
        location = ad.location,
        working_time = ad.working_time,
    } = req.body;
    try {
        db.prepare(
            "UPDATE ads SET title = ?, description = ?, company_id = ?, category_id = ?, salary = ?, location = ?, working_time = ? WHERE id = ?"
        ).run(
            title,
            description,
            company_id,
            category_id,
            salary,
            location,
            working_time,
            ad.id
        );
        res.json(db.prepare("SELECT * FROM ads WHERE id = ?").get(ad.id));
    } catch (err) {
        if (err.code === "SQLITE_CONSTRAINT_FOREIGNKEY" || err.message.includes("FOREIGN KEY")) {
            return res.status(400).json({ error: "L'ID entreprise ou l'ID catégorie renseigné n'existe pas." });
        }
        res.status(500).json({ error: "Erreur serveur : " + err.message });
    }
});

// supprimer une annonce, ses candidatures d'abord
app.delete("/ads/:id", (req, res) => {
    const ad = db.prepare("SELECT * FROM ads WHERE id = ?").get(req.params.id);
    if (!ad) {
        return res.status(404).json({ error: "Annonce introuvable" });
    }
    db.prepare("DELETE FROM applications WHERE ad_id = ?").run(ad.id);
    db.prepare("DELETE FROM ads WHERE id = ?").run(ad.id);
    res.json({ deleted: true });
});

// postuler à une annonce (avec le CV en option)
app.post("/ads/:id/applications", upload.single("cv"), (req, res) => {
    const ad = db.prepare("SELECT * FROM ads WHERE id = ?").get(req.params.id);
    if (!ad) {
        return res.status(404).json({ error: "Annonce introuvable" });
    }
    const { message, name, email, phone } = req.body;
    if (!message) {
        return res.status(400).json({ error: "Message obligatoire" });
    }

// lien du CV seulement si un fichier a été envoyé
    const cv_url = req.file ? "/uploads/" + req.file.filename : null;

// qui postule : le compte connecté, un person_id, ou on crée la personne
    let person_id;
    if (req.session.user) {
        person_id = req.session.user.id;
    } else if (req.body.person_id) {
        person_id = req.body.person_id;
    } else {
        if (!name || !email) {
            return res
                .status(400)
                .json({ error: "Nom et e-mail obligatoires" });
        }
        const existante = db
            .prepare("SELECT id FROM people WHERE email = ?")
            .get(email);
        if (existante) {
            person_id = existante.id;
        } else {
            const nouvelle = db
                .prepare(
                    "INSERT INTO people (name, email, phone) VALUES (?, ?, ?)"
                )
                .run(name, email, phone || null);
            person_id = nouvelle.lastInsertRowid;
        }
    }

// on enregistre la candidature
    const applied_at = new Date().toISOString().slice(0, 10);
    const result = db
        .prepare(
            "INSERT INTO applications (person_id, ad_id, message, applied_at, cv_url) VALUES (?, ?, ?, ?, ?)"
        )
        .run(person_id, ad.id, message, applied_at, cv_url);
    res.status(201).json({ id: result.lastInsertRowid });
});

// ---- entreprises ----

// liste paginée (?page=1&limit=10)
app.get("/companies", (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const total = db.prepare("SELECT COUNT(*) AS n FROM companies").get().n;
    const data = db
        .prepare("SELECT * FROM companies LIMIT ? OFFSET ?")
        .all(limit, offset);
    res.json({ data, page, limit, total });
});

// créer une entreprise
app.post("/companies", (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: "Le nom de l'entreprise est obligatoire." });
    }
    try {
        const result = db
            .prepare("INSERT INTO companies (name) VALUES (?)")
            .run(name);
        res.status(201).json({ id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur : " + err.message });
    }
});

// les annonces d'une entreprise
app.get("/companies/:id/ads", (req, res) => {
    const company = db
        .prepare("SELECT * FROM companies WHERE id = ?")
        .get(req.params.id);
    if (!company) {
        return res.status(404).json({ error: "Entreprise introuvable" });
    }
    const ads = db
        .prepare("SELECT * FROM ads WHERE company_id = ?")
        .all(req.params.id);
    res.json(ads);
});

// une entreprise
app.get("/companies/:id", (req, res) => {
    const company = db
        .prepare("SELECT * FROM companies WHERE id = ?")
        .get(req.params.id);
    if (!company) {
        return res.status(404).json({ error: "Entreprise introuvable" });
    }
    res.json(company);
});

// modifier une entreprise
app.put("/companies/:id", (req, res) => {
    const company = db
        .prepare("SELECT * FROM companies WHERE id = ?")
        .get(req.params.id);
    if (!company) {
        return res.status(404).json({ error: "Entreprise introuvable" });
    }
    const { name = company.name } = req.body;
    db.prepare("UPDATE companies SET name = ? WHERE id = ?").run(
        name,
        company.id
    );
    res.json(
        db.prepare("SELECT * FROM companies WHERE id = ?").get(company.id)
    );
});

// supprimer (409 si elle a encore des annonces)
app.delete("/companies/:id", (req, res) => {
    const company = db
        .prepare("SELECT * FROM companies WHERE id = ?")
        .get(req.params.id);
    if (!company) {
        return res.status(404).json({ error: "Entreprise introuvable" });
    }
    const used = db
        .prepare("SELECT COUNT(*) AS n FROM ads WHERE company_id = ?")
        .get(company.id).n;
    if (used > 0) {
        return res
            .status(409)
            .json({ error: "Cette entreprise a encore des annonces" });
    }
    db.prepare("DELETE FROM companies WHERE id = ?").run(company.id);
    res.json({ deleted: true });
});

// ---- catégories ----

// liste paginée
app.get("/categories", (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const total = db.prepare("SELECT COUNT(*) AS n FROM categories").get().n;
    const data = db
        .prepare("SELECT * FROM categories LIMIT ? OFFSET ?")
        .all(limit, offset);
    res.json({ data, page, limit, total });
});

// une catégorie
app.get("/categories/:id", (req, res) => {
    const category = db
        .prepare("SELECT * FROM categories WHERE id = ?")
        .get(req.params.id);
    if (!category) {
        return res.status(404).json({ error: "Catégorie introuvable" });
    }
    res.json(category);
});

// créer une catégorie
app.post("/categories", (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: "Champ obligatoire manquant" });
    }
    const result = db
        .prepare("INSERT INTO categories (name) VALUES (?)")
        .run(name);
    res.status(201).json({ id: result.lastInsertRowid });
});

// modifier une catégorie
app.put("/categories/:id", (req, res) => {
    const category = db
        .prepare("SELECT * FROM categories WHERE id = ?")
        .get(req.params.id);
    if (!category) {
        return res.status(404).json({ error: "Catégorie introuvable" });
    }
    const { name = category.name } = req.body;
    db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(
        name,
        category.id
    );
    res.json(
        db.prepare("SELECT * FROM categories WHERE id = ?").get(category.id)
    );
});

// supprimer (409 si elle a encore des annonces)
app.delete("/categories/:id", (req, res) => {
    const category = db
        .prepare("SELECT * FROM categories WHERE id = ?")
        .get(req.params.id);
    if (!category) {
        return res.status(404).json({ error: "Catégorie introuvable" });
    }
    const used = db
        .prepare("SELECT COUNT(*) AS n FROM ads WHERE category_id = ?")
        .get(category.id).n;
    if (used > 0) {
        return res
            .status(409)
            .json({ error: "Cette catégorie a encore des annonces" });
    }
    db.prepare("DELETE FROM categories WHERE id = ?").run(category.id);
    res.json({ deleted: true });
});

// ---- personnes (sans le mot de passe) ----

// liste paginée
app.get("/people", (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const total = db.prepare("SELECT COUNT(*) AS n FROM people").get().n;
    const data = db
        .prepare(
            "SELECT id, name, email, phone, role FROM people LIMIT ? OFFSET ?"
        )
        .all(limit, offset);
    res.json({ data, page, limit, total });
});

// une personne
app.get("/people/:id", (req, res) => {
    const person = db
        .prepare("SELECT id, name, email, phone, role FROM people WHERE id = ?")
        .get(req.params.id);
    if (!person) {
        return res.status(404).json({ error: "Personne introuvable" });
    }
    res.json(person);
});

// créer une personne (role user par défaut)
app.post("/people", (req, res) => {
    const { name, email, phone, role } = req.body;
    if (!name || !email) {
        return res.status(400).json({ error: "Champ obligatoire manquant" });
    }
    try {
        const result = db
            .prepare(
                "INSERT INTO people (name, email, phone, role) VALUES (?, ?, ?, ?)"
            )
            .run(name, email, phone, role || "user");
        res.status(201).json({ id: result.lastInsertRowid });
    } catch (err) {
        if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({ error: "Cet email existe déjà" });
        }
        throw err;
    }
});

// modifier une personne
app.put("/people/:id", (req, res) => {
    const person = db
        .prepare("SELECT id, name, email, phone, role FROM people WHERE id = ?")
        .get(req.params.id);
    if (!person) {
        return res.status(404).json({ error: "Personne introuvable" });
    }
    const {
        name = person.name,
        email = person.email,
        phone = person.phone,
        role = person.role,
    } = req.body;
    try {
        db.prepare(
            "UPDATE people SET name = ?, email = ?, phone = ?, role = ? WHERE id = ?"
        ).run(name, email, phone, role, person.id);
    } catch (err) {
        if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({ error: "Cet email existe déjà" });
        }
        throw err;
    }
    res.json(
        db
            .prepare(
                "SELECT id, name, email, phone, role FROM people WHERE id = ?"
            )
            .get(person.id)
    );
});

// supprimer une personne et ses candidatures
app.delete("/people/:id", (req, res) => {
    const person = db
        .prepare("SELECT id FROM people WHERE id = ?")
        .get(req.params.id);
    if (!person) {
        return res.status(404).json({ error: "Personne introuvable" });
    }
    db.prepare("DELETE FROM applications WHERE person_id = ?").run(person.id);
    db.prepare("DELETE FROM people WHERE id = ?").run(person.id);
    res.json({ deleted: true });
});

// ---- candidatures ----

// liste paginée
app.get("/applications", (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const total = db.prepare("SELECT COUNT(*) AS n FROM applications").get().n;
    const data = db
        .prepare("SELECT * FROM applications LIMIT ? OFFSET ?")
        .all(limit, offset);
    res.json({ data, page, limit, total });
});

// une candidature
app.get("/applications/:id", (req, res) => {
    const application = db
        .prepare("SELECT * FROM applications WHERE id = ?")
        .get(req.params.id);
    if (!application) {
        return res.status(404).json({ error: "Candidature introuvable" });
    }
    res.json(application);
});

// créer une candidature
app.post("/applications", (req, res) => {
    const { person_id, ad_id, message } = req.body;
    if (!person_id || !ad_id || !message) {
        return res.status(400).json({ error: "Champ obligatoire manquant" });
    }
    const applied_at = new Date().toISOString().slice(0, 10);
    try {
        const result = db
            .prepare(
                "INSERT INTO applications (person_id, ad_id, message, applied_at) VALUES (?, ?, ?, ?)"
            )
            .run(person_id, ad_id, message, applied_at);
        res.status(201).json({ id: result.lastInsertRowid });
    } catch (err) {
        if (err.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
            return res
                .status(400)
                .json({ error: "Personne ou annonce inexistante" });
        }
        throw err;
    }
});

// modifier une candidature
app.put("/applications/:id", (req, res) => {
    const application = db
        .prepare("SELECT * FROM applications WHERE id = ?")
        .get(req.params.id);
    if (!application) {
        return res.status(404).json({ error: "Candidature introuvable" });
    }
    const {
        person_id = application.person_id,
        ad_id = application.ad_id,
        message = application.message,
        applied_at = application.applied_at,
        cv_url = application.cv_url,
    } = req.body;
    try {
        db.prepare(
            "UPDATE applications SET person_id = ?, ad_id = ?, message = ?, applied_at = ?, cv_url = ? WHERE id = ?"
        ).run(person_id, ad_id, message, applied_at, cv_url, application.id);
    } catch (err) {
        if (err.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
            return res
                .status(400)
                .json({ error: "Personne ou annonce inexistante" });
        }
        throw err;
    }
    res.json(
        db
            .prepare("SELECT * FROM applications WHERE id = ?")
            .get(application.id)
    );
});

// supprimer une candidature
app.delete("/applications/:id", (req, res) => {
    const application = db
        .prepare("SELECT * FROM applications WHERE id = ?")
        .get(req.params.id);
    if (!application) {
        return res.status(404).json({ error: "Candidature introuvable" });
    }
    db.prepare("DELETE FROM applications WHERE id = ?").run(application.id);
    res.json({ deleted: true });
});

// ---- connexion / compte ----

// inscription : le mot de passe est haché avant d'être enregistré
// (si l'email existe déjà sans mot de passe, on complète la fiche)
app.post("/auth/register", (req, res) => {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Champ obligatoire manquant" });
    }
    const hash = bcrypt.hashSync(password, 10);
    const existing = db
        .prepare("SELECT id, password_hash FROM people WHERE email = ?")
        .get(email);
    let id;
    if (existing && existing.password_hash) {
        return res.status(409).json({ error: "Cet email a déjà un compte" });
    } else if (existing) {
        db.prepare(
            "UPDATE people SET name = ?, phone = ?, password_hash = ? WHERE id = ?"
        ).run(name, phone, hash, existing.id);
        id = existing.id;
    } else {
        id = db
            .prepare(
                "INSERT INTO people (name, email, phone, password_hash) VALUES (?, ?, ?, ?)"
            )
            .run(name, email, phone, hash).lastInsertRowid;
    }
    const user = db
        .prepare("SELECT id, name, email, phone, role FROM people WHERE id = ?")
        .get(id);
    req.session.user = user;
    res.status(201).json(user);
});

// connexion : on compare le mot de passe avec le hash, puis on ouvre la session
app.post("/auth/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Champ obligatoire manquant" });
    }
    const person = db
        .prepare("SELECT * FROM people WHERE email = ?")
        .get(email);
    if (
        !person ||
        !person.password_hash ||
        !bcrypt.compareSync(password, person.password_hash)
    ) {
        return res
            .status(401)
            .json({ error: "Email ou mot de passe incorrect" });
    }
    const user = {
        id: person.id,
        name: person.name,
        email: person.email,
        phone: person.phone,
        role: person.role,
    };
    req.session.user = user;
    res.json(user);
});

// déconnexion : on détruit la session
app.post("/auth/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ ok: true });
    });
});

// qui est connecté ? (401 si personne)
app.get("/auth/me", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Non connecté" });
    }
    res.json(req.session.user);
});

// modifier mon compte (le mot de passe seulement s'il est rempli)
app.put("/auth/me", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Non connecté" });
    }
    const { name, email, phone, password } = req.body;
    if (!name || !email) {
        return res.status(400).json({ error: "Champ obligatoire manquant" });
    }
    try {
        if (password) {
            const hash = bcrypt.hashSync(password, 10);
            db.prepare(
                "UPDATE people SET name = ?, email = ?, phone = ?, password_hash = ? WHERE id = ?"
            ).run(name, email, phone || null, hash, req.session.user.id);
        } else {
            db.prepare(
                "UPDATE people SET name = ?, email = ?, phone = ? WHERE id = ?"
            ).run(name, email, phone || null, req.session.user.id);
        }
    } catch (e) {
        if (e.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res
                .status(409)
                .json({ error: "Cet email est déjà utilisé" });
        }
        throw e;
    }
    const user = {
        id: req.session.user.id,
        name,
        email,
        phone: phone || null,
        role: req.session.user.role,
    };
    req.session.user = user;
    res.json(user);
});

// ---- 4. démarrage ----

app.listen(3000, () => {
    console.log("Serveur lancé sur http://localhost:3000");
});