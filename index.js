const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')

const port = process.env.PORT || 8000

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.p2unx4b.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    // Database
    const roomCollection = client.db('stayvista').collection('rooms')
    const usersCollection = client.db('stayvista').collection('users')

    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })

    // verify Admin
    const verifyAdmin = async(req,res,next)=>{
      const user = req.user
      const query = {
        email:user?.email
      }
      const result = await usersCollection.findOne(query)
      if(!result || result.role !== 'admin'){
        return res.status(401).send({ message: 'unauthorized access!!' })
      }
      next()
    } 
    const verifyHost = async(req,res,next) => {
      const user = req.user
      const query = {
        email : user?.email
      }
      const result = await usersCollection.findOne(query)
      if(!result || result.role !== 'host'){
        return res.status(401).send({ message: 'unauthorized access!!' })
      }
      next()
    }



    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })

    // Save User Data in DB
    app.put('/user',async(req,res)=>{
      const user = req.body;
      const option = { upsert : true }
      const query = {
        email: user?.email
      }
      
      // Checking isExeist 
      const isExist = await usersCollection.findOne({email:user?.email})
      // if(isExist)return res.send(isExist)
      if(isExist){
        if(user.status === 'Requested'){
          const result = await usersCollection.updateOne(query,{
            $set:{status:user?.status},
          })
          return res.send(result)
        }
        else{
         return res.send(isExist)
        }
      }
      const updateDoc = {
        $set:{
          ...user,
          timestamp: Date.now(),
        }
      }
      
      const result = await usersCollection.updateOne(query,updateDoc,option)
      res.send(result)
    })

    // Get All room
    app.get('/rooms',async(req,res)=> {
      const category = req.query.category
      let query = {}
      if(category && category !== 'null'){
        query = { category }
      }
      const result = await roomCollection.find(query).toArray()
      res.send(result)
    })

    // Save Room in DB
    app.post('/room',async(req,res)=> {
      const roomData = req.body;
      const result = await roomCollection.insertOne(roomData)
      res.send(result)
    })

    // Get my listings 
    app.get('/my-listings/:email',async(req,res)=>{
      const email = req.params.email;
      const query = {
        'host.email':email
      }
      const result = await roomCollection.find(query).toArray()
      res.send(result)
    })

    // Get single Room by id
    app.get('/room/:id',async(req,res)=> {
      const id = req.params.id
      const query ={
        _id : new ObjectId(id)
      }
      const result = await roomCollection.findOne(query)
      res.send(result)
    })

    // Delete Single Room Data by id
    app.delete('/room/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {
        _id :new ObjectId(id)
      }
      const result = await roomCollection.deleteOne(query)
      res.send(result)
    })

    // get user role 
    app.get('/user/:email',async(req,res)=>{
      const email = req.params.email;
      const query = {
        email: email
      }
      const user = await usersCollection.findOne(query)
      const role = user.role;
      res.send(role)
    })
    // get all the users
    app.get('/users',async(req,res)=>{
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    // Update user
    app.patch('/users/update/:email',async(req,res)=> {
      const email = req.params.email;
      const user = req.body;
      const query = {
        email:email
      }
      const updateUser = {
        $set:{
          ...user,
          timestamp: Date.now()
        }
      }
      const result = await usersCollection.updateOne(query,updateUser)
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from StayVista Server..')
})

app.listen(port, () => {
  console.log(`StayVista is running on port ${port}`)
})
