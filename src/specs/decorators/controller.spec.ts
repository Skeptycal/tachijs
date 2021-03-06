import tachijs, { ConfigSetter, controller, httpGet } from '../../index'
import request from 'supertest'
import { ErrorRequestHandler, RequestHandler } from 'express'

describe('controller', () => {
  it('sets path to router', async () => {
    // When
    @controller('/test')
    class HomeController {
      @httpGet('/')
      index() {
        return 'Hello'
      }
    }

    // Then
    const app = tachijs({
      controllers: [HomeController]
    })
    const response = await request(app).get('/test')
    expect(response).toMatchObject({
      status: 200,
      text: 'Hello'
    })
  })

  it('handles thrown errors', async () => {
    // Given
    const errorHandler: ErrorRequestHandler = (error, req, res, next) =>
      res.status(500).send(error.message)
    const after: ConfigSetter = expressApp => {
      expressApp.use(errorHandler)
    }

    // When
    @controller('/')
    class HomeController {
      @httpGet('/')
      index() {
        throw new Error('Error!')
      }
    }

    // Then
    const app = tachijs({
      controllers: [HomeController],
      after
    })
    const response = await request(app).get('/')
    expect(response).toMatchObject({
      status: 500,
      text: 'Error!'
    })
  })

  it('sets middlewares', async () => {
    // Given
    const spy = jest.fn()
    const middleware: RequestHandler = (req, res, next) => {
      spy()
      next()
    }

    // When
    @controller('/test', [middleware])
    class HomeController {
      @httpGet('/')
      index() {
        return 'Hello'
      }
    }

    // Then
    const app = tachijs({
      controllers: [HomeController]
    })
    const response = await request(app).get('/test')
    expect(response).toMatchObject({
      status: 200,
      text: 'Hello'
    })
    expect(spy).toBeCalled()
  })
})
