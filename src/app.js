import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import bcrypt from "bcrypt"
import joi from "joi";
import {v4 as uuid } from "uuid"
import { ObjectId } from "mongodb";

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
    .then(() => {
        db = mongoClient.db()
        console.log('Connected to the database.')
    })
    .catch((err) => console.log(err.message))


app.post("/cadastro", async (req, res) => {
    const { nome, email, senha } = req.body

    const vali = validaShema.validate(req.body, { abortEarly: false })

    if (vali.error) {
        const errorn = vali.error.details.map((detail) => detail.message)
        return res.status(422).send(errorn);
    }

    console.log(req.body)
    try {
        const usuario = await db.collection("usuario").findOne({ email })
        if (usuario) return res.status(409).send("Usuário já cadastrado com este e-mail!")
        const hash = bcrypt.hashSync(senha, 10)
        await db.collection("usuario").insertOne({ nome, email, senha: hash })
        res.status(201).json({  nome , email });
    } catch (err) {
        res.status(500).send(err.message)
        console.error(err);
    }
})


app.post("/login", async (req, res) => {
    const { email, senha } = req.body
    console.log(req.body)
    console.log(uuid())

    const schema = joi.object({
        email: joi.string().email().required(),
        senha: joi.string().required()
    })

    const { error } = schema.validate(req.body, { abortEarly: false })
    if (error) {
        const errors = error.details.map((err) => err.message)
        return res.status(422).json({ errors })
    }

    try {
        const usuario = await db.collection("usuario").findOne({ email })
        if (!usuario) return res.status(404).send("E-mail não cadastrado.")

       
        const senhaValida = bcrypt.compareSync(senha, usuario.senha)
        if (!senhaValida) return res.status(401).send("Senha incorreta.")

        const token = uuid()

        await db.collection("tokens").insertOne({
            token,
            usuarioId: usuario._id
        })

        res.status(200).json({ token })
    } catch (err) {
        res.status(500).send(err.message)
    }
})
app.post("/transacoes/entrada", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Token not provided" });
  }

  const { descricao, valor } = req.body;

  const { usuarioId } = await db.collection("tokens").findOne({ token });
  if (!usuarioId || !ObjectId.isValid(usuarioId)) {
    return res.status(401).json({ error: "Invalid user ID" });
  }

  try {
    await db.collection("transacoes").insertOne({
      descricao,
      valor,
      tipo: "entrada",
      usuarioId: new ObjectId(usuarioId),
      data: new Date(),
    });

    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
  
app.post("/transacoes/saida", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Token not provided" });
  }

  const { descricao, valor } = req.body;

  const { usuarioId } = await db.collection("tokens").findOne({ token });
  if (!usuarioId || !ObjectId.isValid(usuarioId)) {
    return res.status(401).json({ error: "Invalid user ID" });
  }

  try {
    await db.collection("transacoes").insertOne({
      descricao,
      valor,
      tipo: "saida",
      usuarioId: new ObjectId(usuarioId),
      data: new Date(),
    });

    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err.message);
  }
});



  app.get("/transacoes", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
  
    if (!token) {
      return res.status(401).json({ error: "Token not provided" });
    }
  
    try {
      const tokenData = await db.collection("tokens").findOne({ token });
      if (!tokenData) {
        return res.sendStatus(401);
      }
  
      const usuario = await db.collection("usuario").findOne({ _id: new ObjectId(tokenData.usuarioId) });
      const transacoes = await db.collection("transacoes").find({ usuarioId: tokenData.usuarioId }).toArray();
      res.json({ nome: usuario.nome, transacoes });
    } catch (err) {
      res.status(500).send(err.message);
    }
  });


const PORT = 5000
app.listen(PORT, () => console.log("Server listening on port 5000"))
