import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import bcrypt from "bcrypt"
import joi from "joi";


const app = express()

const validaShema = joi.object({
    nome: joi.string().required(),
    email: joi.string().email().required(),
    senha: joi.string().required().min(3)
})
app.use(express.json())
app.use(cors())
dotenv.config()

let db
const mongoClient = new MongoClient(process.env.DATABASE_URL)
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))




app.post("/cadastro", async (req, res) => {
    const { nome, email, senha } = req.body

    const vali = validaShema.validate(req.body, { abortEarly: false })

    if (vali.error) {
        const errorn = vali.errorn.detals.map((detail) => detail.message)
        return res.status(422).send(errorn);
    }

    console.log(req.body)
    try {
        const usuario = await db.collection("usuario").findOne({ email })
        if (usuario) return res.status(409).send("Usuário já cadastrado com este e-mail!")
        const hash = bcrypt.hashSync(senha, 10)
        await db.collection("usuario").insertOne({ nome, email, senha: hash })
        res.sendStatus(201)
    } catch (err) {
        res.status(500).send(err.message)
    }
})


app.post("/login", async (req, res) => {
    const { email, senha } = req.body
    console.log(req.body)

    try {
        const usuario = await db.collection("usuario").findOne({ email })
        if (!usuario) return res.status(401).send("Email incorreto!")

        const verificaSenha = bcrypt.compareSync(senha, usuario.senha)
        if (!verificaSenha) return res.status(401).send("Senha incorreta!")

        res.sendStatus(200)

    } catch (err) {
        res.status(500).send(err.message)
    }
})

const PORT = 5000
app.listen(PORT, () => console.log("Server listening on port 5000"))
