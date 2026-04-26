import { describe, it, expect, afterEach, vi } from 'vitest'
import request from 'supertest'
import app from '../gateway-service.js'
import axios from 'axios'

vi.mock('axios')

describe('Gateway Service', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  // ── /leaderboard ─────────────────────────────────────────────────────────────

  describe('GET /leaderboard', () => {
    it('returns leaderboard data from users service', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          leaderboard: [
            { username: 'top1', wins: 5, losses: 1, total: 6, winRate: 83 },
            { username: 'top2', wins: 3, losses: 2, total: 5, winRate: 60 },
          ]
        }
      })

      const res = await request(app).get('/leaderboard')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.leaderboard)).toBe(true)
      expect(res.body.leaderboard[0]).toHaveProperty('username')
      expect(res.body.leaderboard[0]).toHaveProperty('wins')
      expect(res.body.leaderboard[0]).toHaveProperty('losses')
      expect(res.body.leaderboard[0]).toHaveProperty('winRate')
      expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/leaderboard$/))
    })

    it('returns empty leaderboard when no games have been played', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: { success: true, leaderboard: [] }
      })

      const res = await request(app).get('/leaderboard')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.leaderboard).toHaveLength(0)
    })

    it('returns 500 if users service is unreachable', async () => {
      axios.get.mockRejectedValueOnce(new Error('Service down'))

      const res = await request(app).get('/leaderboard')

      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/User service unavailable/i)
    })

    it('propagates upstream HTTP error status', async () => {
      axios.get.mockRejectedValueOnce({
        response: { status: 503, data: { error: 'Service unavailable' } }
      })

      const res = await request(app).get('/leaderboard')

      expect(res.status).toBe(503)
      expect(res.body.error).toMatch(/Service unavailable/i)
    })

    it('propagates 500 from users service', async () => {
      axios.get.mockRejectedValueOnce({
        response: { status: 500, data: { error: 'Internal server error' } }
      })

      const res = await request(app).get('/leaderboard')

      expect(res.status).toBe(500)
    })
  })

  // ── /game/move ───────────────────────────────────────────────────────────────

  describe('POST /game/move', () => {
    it('returns updated YEN on success', async () => {
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: { layout: '..X..', players: [], size: 5 }
      })

      const res = await request(app)
          .post('/game/move')
          .send({ yen: { size: 5, layout: '.....' }, row: 0, col: 2 })

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body).toHaveProperty('yen')
      expect(axios.post).toHaveBeenCalledTimes(1)
    })

    it('unwraps YEN when nested under payload.yen', async () => {
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: { yen: { layout: '..X..', players: [], size: 5 }, finished: false, winner: null }
      })

      const res = await request(app)
          .post('/game/move')
          .send({ yen: { size: 5, layout: '.....' }, row: 0, col: 2 })

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.yen).toMatchObject({ layout: '..X..' })
    })

    it('returns finished/winner/winning_edges when game ends', async () => {
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          yen: { layout: 'XXXXX', players: [], size: 5 },
          finished: true,
          winner: 'X',
          winning_edges: [[0, 0], [0, 4]]
        }
      })

      const res = await request(app)
          .post('/game/move')
          .send({ yen: { size: 5, layout: '.....' }, row: 0, col: 4 })

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.finished).toBe(true)
      expect(res.body.winner).toBe('X')
      expect(res.body.winning_edges).toEqual([[0, 0], [0, 4]])
    })

    it('returns 400 if YEN is missing', async () => {
      const res = await request(app)
          .post('/game/move')
          .send({ row: 0, col: 0 })

      expect(res.status).toBe(400)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Missing YEN/i)
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('returns 400 if row is missing', async () => {
      const res = await request(app)
          .post('/game/move')
          .send({ yen: { size: 5 }, col: 0 })

      expect(res.status).toBe(400)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Missing row\/col/i)
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('returns 400 if col is missing', async () => {
      const res = await request(app)
          .post('/game/move')
          .send({ yen: { size: 5 }, row: 0 })

      expect(res.status).toBe(400)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Missing row\/col/i)
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('propagates upstream HTTP error status', async () => {
      axios.post.mockRejectedValueOnce({
        response: { status: 422, data: { error: 'Illegal move' } }
      })

      const res = await request(app)
          .post('/game/move')
          .send({ yen: { size: 5, layout: '.....' }, row: 0, col: 0 })

      expect(res.status).toBe(422)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Illegal move/i)
    })

    it('returns 502 if game server is unreachable', async () => {
      axios.post.mockRejectedValueOnce(new Error('Server down'))

      const res = await request(app)
          .post('/game/move')
          .send({ yen: { size: 5, layout: '.....' }, row: 0, col: 0 })

      expect(res.status).toBe(502)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Game server unavailable/i)
    })

    it('calls the correct game move URL', async () => {
      axios.post.mockResolvedValueOnce({ status: 200, data: {} })

      await request(app)
          .post('/game/move')
          .send({ yen: { size: 5 }, row: 2, col: 3 })

      expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('/v1/game/move'),
          expect.objectContaining({ row: 2, col: 3 })
      )
    })
  })

  // ── /game/new ────────────────────────────────────────────────────────────────

  describe('POST /game/new', () => {
    it('returns YEN when game server responds correctly', async () => {
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: { size: 5, turn: 0, layout: '.....' }
      })

      const res = await request(app).post('/game/new').send({ size: 5 })

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body).toHaveProperty('yen')
      expect(axios.post).toHaveBeenCalledTimes(1)
    })

    it('returns 502 if game server is unreachable', async () => {
      axios.post.mockRejectedValueOnce(new Error('Server down'))

      const res = await request(app).post('/game/new').send({ size: 5 })

      expect(res.status).toBe(502)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Game server unavailable/i)
    })

    it('propagates upstream HTTP error status', async () => {
      axios.post.mockRejectedValueOnce({
        response: { status: 503, data: { error: 'Downstream error' } }
      })

      const res = await request(app).post('/game/new').send({ size: 5 })

      expect(res.status).toBe(503)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Downstream error/i)
    })
  })

  // ── /game/pvb/move ───────────────────────────────────────────────────────────

  describe('POST /game/pvb/move', () => {
    it('returns updated YEN on success', async () => {
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: { size: 5, turn: 1, layout: '...B.' }
      })

      const res = await request(app)
          .post('/game/pvb/move')
          .send({ yen: { size: 5, turn: 0, layout: '.....' }, bot: 'random_bot', row: 0, col: 0 })

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body).toHaveProperty('yen')
      expect(axios.post).toHaveBeenCalledTimes(1)
    })

    it('returns finished/winner/winning_edges when backend sends them', async () => {
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          yen: { size: 5, turn: 2, layout: '...B.' },
          finished: true,
          winner: 'B',
          winning_edges: [[0, 0], [0, 1]]
        }
      })

      const res = await request(app)
          .post('/game/pvb/move')
          .send({ yen: { size: 5, turn: 1, layout: '.....' }, bot: 'smart_bot', row: 0, col: 0 })

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.finished).toBe(true)
      expect(res.body.winner).toBe('B')
      expect(res.body.winning_edges).toEqual([[0, 0], [0, 1]])
    })

    it('returns 400 if YEN is missing', async () => {
      const res = await request(app)
          .post('/game/pvb/move')
          .send({ bot: 'random_bot', row: 0, col: 0 })

      expect(res.status).toBe(400)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Missing YEN/i)
    })

    it('returns 400 if row/col are missing', async () => {
      const res = await request(app)
          .post('/game/pvb/move')
          .send({ yen: { size: 5 }, bot: 'random_bot' })

      expect(res.status).toBe(400)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Missing row\/col/i)
    })

    it('returns 400 for an invalid bot id', async () => {
      const res = await request(app)
          .post('/game/pvb/move')
          .send({ yen: { size: 5 }, bot: 'evil_bot', row: 0, col: 0 })

      expect(res.status).toBe(400)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Invalid bot id/i)
    })

    it('propagates upstream HTTP error status', async () => {
      axios.post.mockRejectedValueOnce({
        response: { status: 422, data: { error: 'Illegal move' } }
      })

      const res = await request(app)
          .post('/game/pvb/move')
          .send({ yen: { size: 5, turn: 0, layout: '.....' }, bot: 'random_bot', row: 0, col: 0 })

      expect(res.status).toBe(422)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Illegal move/i)
    })

    it('calls the correct URL using the bot id', async () => {
      axios.post.mockResolvedValueOnce({ status: 200, data: {} })

      await request(app)
          .post('/game/pvb/move')
          .send({ yen: { size: 5 }, bot: 'minimax_bot', row: 1, col: 2 })

      expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('/v1/game/pvb/minimax_bot'),
          expect.objectContaining({ row: 1, col: 2 })
      )
    })
  })

  // ── /game/bot/choose ─────────────────────────────────────────────────────────

  describe('POST /game/bot/choose', () => {
    it('returns coordinates on success', async () => {
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: { coords: { x: 0, y: 1, z: 3 } }
      })

      const res = await request(app)
          .post('/game/bot/choose')
          .send({ yen: { size: 5, turn: 0, layout: '.....' }, bot: 'random_bot' })

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.coordinates).toEqual({ x: 0, y: 1, z: 3 })
      expect(axios.post).toHaveBeenCalledTimes(1)
    })

    it('returns 400 if YEN is missing', async () => {
      const res = await request(app)
          .post('/game/bot/choose')
          .send({ bot: 'random_bot' })

      expect(res.status).toBe(400)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Missing YEN/i)
    })

    it('returns 400 for an invalid bot id', async () => {
      const res = await request(app)
          .post('/game/bot/choose')
          .send({ yen: { size: 5 }, bot: 'invalid_bot' })

      expect(res.status).toBe(400)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Invalid bot id/i)
    })

    it('propagates upstream HTTP error status', async () => {
      axios.post.mockRejectedValueOnce({
        response: { status: 429, data: { message: 'Rate limited' } }
      })

      const res = await request(app)
          .post('/game/bot/choose')
          .send({ yen: { size: 5, turn: 0, layout: '.....' }, bot: 'smart_bot' })

      expect(res.status).toBe(429)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Rate limited/i)
    })

    it('calls the correct URL using the bot id', async () => {
      axios.post.mockResolvedValueOnce({ status: 200, data: { coords: {} } })

      await request(app)
          .post('/game/bot/choose')
          .send({ yen: { size: 5 }, bot: 'alfa_beta_bot' })

      expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('/v1/ybot/choose/alfa_beta_bot'),
          expect.anything()
      )
    })
  })

  // ── /game/status ─────────────────────────────────────────────────────────────

  describe('GET /game/status', () => {
    it('returns message when game server is healthy', async () => {
      axios.get.mockResolvedValueOnce({ status: 200, data: 'GameY running' })

      const res = await request(app).get('/game/status')

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.message).toBe('GameY running')
    })

    it('returns 502 if game server is unreachable', async () => {
      axios.get.mockRejectedValueOnce(new Error('Server down'))

      const res = await request(app).get('/game/status')

      expect(res.status).toBe(502)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Game server unavailable/i)
    })

    it('propagates upstream HTTP error status', async () => {
      axios.get.mockRejectedValueOnce({
        response: { status: 504, data: { message: 'Timeout' } }
      })

      const res = await request(app).get('/game/status')

      expect(res.status).toBe(504)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Timeout/i)
    })
  })

  // ── /bots ────────────────────────────────────────────────────────────────────

  describe('GET /bots', () => {
    it('returns available bots sorted alphabetically', async () => {
      // First call: probe game creation
      axios.post.mockResolvedValueOnce({ data: { size: 3 } })
      // Subsequent calls: only random_bot succeeds
      axios.post
          .mockResolvedValueOnce({})         // random_bot
          .mockRejectedValue(new Error())    // all others fail

      const res = await request(app).get('/bots')

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.bots).toContain('random_bot')
      expect(res.body.bots).toEqual([...res.body.bots].sort())
    })

    it('returns 502 if the probe game cannot be created', async () => {
      axios.post.mockRejectedValueOnce(new Error('fail'))

      const res = await request(app).get('/bots')

      expect(res.status).toBe(502)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Game server unavailable/i)
    })
  })

  // ── /createuser ──────────────────────────────────────────────────────────────

  describe('POST /createuser', () => {
    it('forwards request and returns created user response', async () => {
      axios.post.mockResolvedValueOnce({
        status: 201,
        data: { success: true, message: 'User Ana created' }
      })

      const payload = { username: 'Ana', email: 'ana@uniovi.es', password: '123456' }

      const res = await request(app).post('/createuser').send(payload)

      expect(res.status).toBe(201)
      expect(res.body.message).toMatch(/User Ana created/i)
      expect(axios.post).toHaveBeenCalledWith(
          expect.stringMatching(/\/createuser$/),
          payload
      )
    })

    it('returns 500 if user service is unreachable', async () => {
      axios.post.mockRejectedValueOnce(new Error('Service down'))

      const res = await request(app)
          .post('/createuser')
          .send({ username: 'Ana', email: 'ana@uniovi.es', password: '123456' })

      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/User service unavailable/i)
    })

    it('propagates upstream HTTP error status', async () => {
      axios.post.mockRejectedValueOnce({
        response: { status: 409, data: { error: 'User already exists' } }
      })

      const res = await request(app)
          .post('/createuser')
          .send({ username: 'Ana', email: 'ana@uniovi.es', password: '123456' })

      expect(res.status).toBe(409)
      expect(res.body.error).toMatch(/User already exists/i)
    })
  })

  // ── /login ───────────────────────────────────────────────────────────────────

  describe('POST /login', () => {
    it('forwards request to auth service and returns token response', async () => {
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: { success: true, message: 'Welcome Ana', user: { username: 'Ana' } }
      })

      const payload = { username: 'Ana', password: '123456' }

      const res = await request(app).post('/login').send(payload)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toMatch(/Welcome Ana/i)
      // Login is handled by the AUTH service, not the users service
      expect(axios.post).toHaveBeenCalledWith(
          expect.stringMatching(/\/login$/),
          payload
      )
    })

    it('propagates upstream HTTP error status', async () => {
      axios.post.mockRejectedValueOnce({
        response: { status: 401, data: { error: 'Invalid credentials' } }
      })

      const res = await request(app)
          .post('/login')
          .send({ username: 'Ana', password: 'wrong' })

      expect(res.status).toBe(401)
      expect(res.body.error).toMatch(/Invalid credentials/i)
    })

    it('returns 500 if auth service is unreachable', async () => {
      axios.post.mockRejectedValueOnce(new Error('Service down'))

      const res = await request(app)
          .post('/login')
          .send({ username: 'Ana', password: '123456' })

      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/User service unavailable/i)
    })
  })

  // ── /verify ──────────────────────────────────────────────────────────────────

  describe('GET /verify', () => {
    it('returns auth payload when token is valid', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: { success: true, username: 'Ana' }
      })

      const res = await request(app)
          .get('/verify')
          .set('Authorization', 'Bearer valid.token.here')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.username).toBe('Ana')
      expect(axios.get).toHaveBeenCalledWith(
          expect.stringMatching(/\/verify$/),
          expect.objectContaining({
            headers: expect.objectContaining({ Authorization: 'Bearer valid.token.here' })
          })
      )
    })

    it('returns 401 if Authorization header is missing', async () => {
      const res = await request(app).get('/verify')

      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toMatch(/Missing token/i)
      expect(axios.get).not.toHaveBeenCalled()
    })

    it('propagates upstream HTTP error status', async () => {
      axios.get.mockRejectedValueOnce({
        response: { status: 403, data: { success: false, error: 'Forbidden' } }
      })

      const res = await request(app)
          .get('/verify')
          .set('Authorization', 'Bearer expired.token')

      expect(res.status).toBe(403)
      expect(res.body.success).toBe(false)
    })

    it('returns 500 if auth service is unreachable', async () => {
      axios.get.mockRejectedValueOnce(new Error('Service down'))

      const res = await request(app)
          .get('/verify')
          .set('Authorization', 'Bearer some.token')

      expect(res.status).toBe(500)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toMatch(/Auth service unavailable/i)
    })
  })

  // ── /gameresult ──────────────────────────────────────────────────────────────

  describe('POST /gameresult', () => {
    it('forwards request and returns created result', async () => {
      axios.post.mockResolvedValueOnce({ status: 201, data: { success: true } })

      const res = await request(app)
          .post('/gameresult')
          .send({ username: 'Ana', opponent: 'bot', result: 'win', score: 10 })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
    })

    it('propagates upstream HTTP error status', async () => {
      axios.post.mockRejectedValueOnce({
        response: { status: 400, data: { error: 'Bad request' } }
      })

      const res = await request(app).post('/gameresult').send({})

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Bad request/i)
    })

    it('returns 500 if user service is unreachable', async () => {
      axios.post.mockRejectedValueOnce(new Error('Service down'))

      const res = await request(app).post('/gameresult').send({})

      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/User service unavailable/i)
    })
  })

  // ── /history/:username ───────────────────────────────────────────────────────

  describe('GET /history/:username', () => {
    it('returns game history for a user', async () => {
      axios.get.mockResolvedValueOnce({ status: 200, data: { games: [] } })

      const res = await request(app).get('/history/Ana')

      expect(res.status).toBe(200)
      expect(res.body.games).toBeDefined()
    })

    it('appends limit query param when provided', async () => {
      axios.get.mockResolvedValueOnce({ status: 200, data: { games: [] } })

      const res = await request(app).get('/history/Ana?limit=5')

      expect(res.status).toBe(200)
      expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/limit=5/))
    })

    it('propagates upstream HTTP error status', async () => {
      axios.get.mockRejectedValueOnce({
        response: { status: 404, data: { error: 'User not found' } }
      })

      const res = await request(app).get('/history/nobody')

      expect(res.status).toBe(404)
      expect(res.body.error).toMatch(/User not found/i)
    })

    it('returns 500 if user service is unreachable', async () => {
      axios.get.mockRejectedValueOnce(new Error('fail'))

      const res = await request(app).get('/history/Ana')

      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/User service unavailable/i)
    })
  })
  // ── /ranking ─────────────────────────────────────────────────────────────────

  describe('GET /ranking', () => {
    it('returns ranking list', async () => {
      axios.get.mockResolvedValueOnce({ status: 200, data: { ranking: [] } })

      const res = await request(app).get('/ranking')

      expect(res.status).toBe(200)
      expect(res.body.ranking).toBeDefined()
    })

    it('returns 500 if user service is unreachable', async () => {
      axios.get.mockRejectedValueOnce(new Error('fail'))

      const res = await request(app).get('/ranking')

      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/User service unavailable/i)
    })

    it('propagates upstream HTTP error status', async () => {
      axios.get.mockRejectedValueOnce({
        response: { status: 503, data: { error: 'Service unavailable' } }
      })

      const res = await request(app).get('/ranking')

      expect(res.status).toBe(503)
    })
  })

  // ── assertValidBot (unit) ───────────────────────────────────────────────────
  // These tests confirm the SSRF fix: the function must return a value sourced
  // from CANDIDATE_BOT_IDS (our own Set), never the raw user-supplied string.

  describe('assertValidBot (internal)', () => {
    // We exercise it indirectly through an endpoint so we don't have to export it.

    it('accepts every known bot id and routes the request correctly', async () => {
      const knownBots = [
        'random_bot', 'smart_bot', 'heuristic_bot', 'minimax_bot',
        'alfa_beta_bot', 'monte_carlo_hard', 'monte_carlo_extreme', 'monte_carlo_bot',
      ]

      for (const bot of knownBots) {
        axios.post.mockResolvedValueOnce({ status: 200, data: { coords: {} } })

        const res = await request(app)
            .post('/game/bot/choose')
            .send({ yen: { size: 5 }, bot })

        expect(res.status).toBe(200, `expected 200 for bot: ${bot}`)
        vi.clearAllMocks()
      }
    })

    it('rejects an unknown bot id with 400', async () => {
      const res = await request(app)
          .post('/game/bot/choose')
          .send({ yen: { size: 5 }, bot: 'evil_bot' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Invalid bot id/i)
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('rejects a non-string bot value with 400', async () => {
      const res = await request(app)
          .post('/game/bot/choose')
          .send({ yen: { size: 5 }, bot: 42 })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Invalid bot id/i)
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('rejects a bot id that is a superset of a valid id', async () => {
      const res = await request(app)
          .post('/game/bot/choose')
          .send({ yen: { size: 5 }, bot: 'random_bot_evil' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Invalid bot id/i)
    })
  })

  // ── /play ────────────────────────────────────────────────────────────────────

  describe('GET /play', () => {
    it('returns 400 if position query param is missing', async () => {
      const res = await request(app).get('/play')

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Missing position/i)
    })

    it('forwards position and bot_id to bot API and returns response', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: { coords: { row: 1, col: 2 } }
      })

      const res = await request(app)
          .get('/play')
          .query({ position: '....X....', bot_id: 'random_bot' })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('coords')
      expect(axios.get).toHaveBeenCalledWith(
          expect.stringMatching(/\/play$/),
          expect.objectContaining({
            params: expect.objectContaining({
              position: '....X....',
              bot_id: 'random_bot'
            })
          })
      )
    })

    it('returns 500 if bot API fails', async () => {
      axios.get.mockRejectedValueOnce(new Error('Bot API down'))

      const res = await request(app)
          .get('/play')
          .query({ position: '....X....', bot_id: 'random_bot' })

      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/play failed/i)
    })
  })
})