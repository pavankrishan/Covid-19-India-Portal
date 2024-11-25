const express = require('express')
const bcrypt = require('bcrypt')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const jwt = require('jsonwebtoken')

const app = express()

app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const intializeSeverAndDb = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server is running')
    })
  } catch (e) {
    console.log(`Database Error: ${e.message}`)
    process.exit(1)
  }
}

intializeSeverAndDb()

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'pavan', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

// API-1 - Post

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const userdet = `
    SELECT 
      *
    FROM 
      user
    WHERE username='${username}'
    `
  const getUserDet = await db.get(userdet)

  if (getUserDet === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const ispassmatch = await bcrypt.compare(password, getUserDet.password)
    if (ispassmatch) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'pavan')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//API -2

const convert = dbObj => {
  return {
    stateId: dbObj.state_id,
    stateName: dbObj.state_name,
    population: dbObj.population,
  }
}

app.get('/states/', authenticateToken, async (request, response) => {
  const allStates = `
  SELECT 
    *
  FROM 
    state
  `
  const dbStates = await db.all(allStates)
  response.send(dbStates.map(each => convert(each)))
})

//API- 3

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getState = `
  SELECT
    *
  FROM 
    state
  WHERE 
    state_id=${stateId}
  `
  const selectState = await db.get(getState)
  response.send(convert(selectState))
})

//API-4

app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const postDet = `
  INSERT INTO
    district(district_name,state_id,cases,cured,active,deaths)
  VALUES
    (
    '${districtName}',
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths})
  `
  await db.run(postDet)
  response.send('District Successfully Added')
})

//API-5

convertDist = dbObj => {
  return {
    districtId: dbObj.district_id,
    districtName: dbObj.district_name,
    stateId: dbObj.state_id,
    cases: dbObj.cases,
    cured: dbObj.cured,
    active: dbObj.active,
    deaths: dbObj.deaths,
  }
}

app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDist = `
  SELECT 
    *
  FROM 
    district
  WHERE 
    district_id=${districtId}
  `
    const distDet = await db.get(getDist)
    response.send(convertDist(distDet))
  },
)

//API-6

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const delDist = `
  DELETE FROM
    district
  WHERE
    district_id=${districtId}
  `
    await db.run(delDist)
    response.send('District Removed')
  },
)

//API-7

app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDetails = `
  UPDATE
    district
  SET
    district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}
  WHERE
    district_id=${districtId}

  `
    await db.run(updateDetails)
    response.send('District Details Updated')
  },
)

//API-8

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const gettotal = `
  SELECT
    SUM(cases),
    SUM(cured),
    SUM(active),
    SUM(deaths)
  FROM
    district
  WHERE
    state_id=${stateId}
  `
    const getTotDe = await db.get(gettotal)
    console.log(getTotDe)
    response.send({
      totalCases: getTotDe['SUM(cases)'],
      totalCured: getTotDe['SUM(cured)'],
      totalActive: getTotDe['SUM(active)'],
      totalDeaths: getTotDe['SUM(deaths)'],
    })
  },
)

module.exports = app
