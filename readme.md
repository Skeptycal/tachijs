# TachiJS

[![Build Status](https://travis-ci.com/BoostIO/tachijs.svg?branch=master)](https://travis-ci.com/BoostIO/tachijs)
[![codecov](https://codecov.io/gh/BoostIO/tachijs/branch/master/graph/badge.svg)](https://codecov.io/gh/BoostIO/tachijs)
[![NPM download](https://img.shields.io/npm/dm/tachijs.svg)](https://www.npmjs.com/package/tachijs)

> [Tachi(太刀) https://en.wikipedia.org/wiki/Tachi](https://en.wikipedia.org/wiki/Tachi)

Highly testable dead simple web server written in Typescript

- :checkered_flag: **Highly testable.** (all props in `req` and `res` are injectable so you don't have to mock at all.)
- :wrench: **Highly customizable.**
- :syringe: **Simple dependency injection.**
- :zap: **`async/await` request handler.** (like Koa without any configurations.)
- :factory: **Based on expressjs.** (You can benefit from using this mature library)
- :white_check_mark: **Built-in request body validator.**
- :triangular_ruler: **Written in Typescript.**

## Why?

`Nest.js` looks nice. But its learning curve is too stiff.(TBH, I still don't know how to redirect dynamically.) Most of people probably do not need to know how `Interceptor`, `Pipe` and other things work. It might be good for some enterprize level projects.

But using raw `expressjs` is also quite painful. To test express apps, you have to use `supertest` or `chai-http` things. If you use them, you will lose debugging and error stack while testing because they send actual http request internally. Otherwise, you have to mock up all params, `req`, `res` and `next`, of RequestHandler of express.js.

To deal with the testing problem, `inversify-express-utils` could be a solution. But it does not support many decorators. To render with view engine like pug, we need to use `res.render` method. But the only solution is using `@response` decorator. It means you have to mock up `Response` in your test. So technically it is super hard to test routes rendering view engine.

Luckily, TachiJS tackles those problems. If you have other ideas, please create an issue!!

## How to use

### Install tachijs

```sh
npm i tachijs reflect-metadata
```

Add two compiler options, `experimentalDecorators` and `emitDecoratorMetadata`, to `tsconfig.json`.

```json
{
  "compilerOptions": {
    ...
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    ...
  }
}
```

### Quick start

```ts
import tachijs, { controller, httpGet } from 'tachijs'

@controller('/')
class HomeController() {
  // Define when this method should be used.
  @httpGet('/')
  index() {
    return {
      message: 'Hello, world!'
    }
  }
}

// Register `HomeController`
const app = tachijs({
  controllers: [HomeController]
})

// `app` is just an express application instance
app.listen(8000)
```

Now you can access [http://localhost:8000/](http://localhost:8000/).

For other http methods, tachijs provides `@httpPost`, `@httpPut`, `@httpPatch`, `@httpDelete`, `@httpOptions`, `@httpHead` and `@httpAll`.

### Configuring express app(Middlewares)

There are lots of ways to implement express middlewares.

#### Use `before` and `after` options

```ts
import bodyParser from 'body-parser'
import { ConfigSetter, NotFoundException } from 'tachijs'

const before: ConfigSetter = app => {
  app.use(bodyParser())
}

const after: ConfigSetter = app => {
  app.use('*', (req, res, next) => {
    next(new NotFoundException('Page does not exist.'))
  })

  const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
    const { status = 500, message } = error
    res.status(status).json({
      status,
      message
    })
  }
  app.use(errorHandler)
}

const app = tachijs({
  before,
  after
})

app.listen(8000)
```

#### Without `before` or `after` options

Identically same to the above example.

```ts
import express from 'express'
import bodyParser from 'body-parser'
import { ConfigSetter, NotFoundException } from 'tachijs'

const app = express()
app.use(bodyParser())

tachijs({
  app
})

app.use('*', (req, res, next) => {
  next(new NotFoundException('Page does not exist.'))
})

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  const { status = 500, message } = error
  res.status(status).json({
    status,
    message
  })
}
app.use(errorHandler)

app.listen(8000)
```

#### Apply middlewares to controllers and methods

Sometimes, you might want to apply middlewares to several methods only.

```ts
import { controller, httpGet, ForbiddenException } from 'tachijs'
import cors from 'cors'
import { RequestHandler } from 'express'

const onlyAdmin: RequestHandler = (req, res, next) => {
  if (!req.user.admin) {
    next(new ForbiddenException('Only admin users can access this api'))
    return
  }
  next()
}

// Apply `cors()` to controller. Now all methods will use the middleware.
@controller('/', [cors()])
class HomeController() {
  @httpGet('/')
  index() {
    return {
      message: 'Hello, world!'
    }
  }

  // Apply `onlyAdmin` to `admin` method. This middleware will be applied to this method only.
  @httpGet('/', [onlyAdmin])
  admin() {
    return {
      message: 'Hello, world!'
    }
  }
}
```

### Access `req.params`, `req.query` and `req.body` via decorators

You can access them via `@reqParams`, `@reqQuery` and `@reqBody`.
(Don't forget to apply `body-parser` middleware)

```ts
import {
  controller,
  httpGet,
  httpPost,
  reqParams,
  reqQuery,
  reqBody
} from 'tachijs'

@controller('/posts')
class PostController() {
  @httpGet('/:postId')
  // `req.params.postId`
  async show(@reqParams('postId') postId: string) {
    const post = await Post.findById(postId)

    return {
      post
    }
  }

  @httpGet('/search')
  // `req.query.title`
  async search(@reqQuery('title') title: string = '') {
    const posts = await Post.find({
      title
    })

    return {
      posts
    }
  }

  @httpPost('/')
  // `req.body` (`@reqBody` does not accept property keys.)
  async create(@reqBody() body: unknown) {
    const validatedBody = validate(body)
    const post = await Post.create({
      ...validatedBody
    })

    return {
      post
    }
  }
}
```

We also provide `reqHeaders`, `reqCookies` and `reqSession` for `req.headers`, `req.cookies` and `req.session`. To know more, see our api documentation below.

#### Body validation

`@reqBody` supports validation via `class-validator`.

Please install `class-validator` package first.

```sh
npm install class-validator
```

```ts
import { IsString } from 'class-validator'

class PostDTO {
  @IsString()
  title: string

  @IsString()
  content: string
}


@controller('/posts')
class PostController() {
  @httpPost('/')
  // Tachijs can access `PostDTO` via reflect-metadata.
  async create(@reqBody() body: PostDTO) {
    // `body` is already validated and transformed into an instance of `PostDTO`.
    // So we don't need any extra validation.
    const post = await Post.create({
      ...body
    })

    return {
      post
    }
  }
}
```

#### Custom parameter decorators!

If you're using `passport`, you should want to access user data from `req.user`.
`@handlerParam` decorator make it possible. The decorator gets a selector which accepts express's `req`, `res` and `next`. So all you need to do is decide what to return from thoes three parameters.

```ts
import { controller, httpGet, handlerParam } from 'tachijs'

@controller('/')
class HomeController {
  @httpGet('/')
  async showId(@handlerParam((req, res, next) => req.user) user: any) {
    doSomethingWithUser(user)

    return {
      ...
    }
  }
}
```

If you want reusable code, please try like the below.

```ts
import { controller, httpGet, handlerParam } from 'tachijs'

function reqUser() {
  // You can omit other next params, `res` and `next`, if you don't need for your selector.
  return handlerParam(req => req.user)
}

@controller('/')
class HomeController {
  @httpGet('/')
  async showId(@reqUser() user: any) {
    doSomethingWithUser(user)

    return {
      ...
    }
  }
}
```

##### Bind methods of `req` or `res` before exposing

You can also pass methods of `req` or `res` which are augmented by express module.
Some of them might need the context of them.
So please bind methods before exposing like the below example.

```ts
export function cookieSetter() {
  return handlerParam((req, res) => res.cookie.bind(res))
}
```

##### `design:paramtype`

Moreover, tachijs exposes metadata of parameters to forth argument. So you can make your custom validator for query with `class-transformer-validator` like below. (`req.body` is also using this.)

```ts
import { controller, httpGet, handlerParam } from 'tachijs'
import { IsString } from 'class-validator'
import { transformAndValidate } from 'class-transformer-validator'

function validatedQuery() {
  return handlerParam((req, res, next, meta) => {
    // meta.paramType is from `design:paramtypes`.
    // It is `Object` if the param type is unknown or any.
    return meta.paramType !== Object
      ? transformAndValidate(meta.paramType, req.query)
      : req.query
  })
}

// Validator class
class SearchQuery {
  @IsString()
  title: string
}

@controller('/')
class PostController {
  @httpGet('/search')
  // Provide the validator class to param type.
  // tachijs can access it via `reflect-metadata`.
  search(@validatedQuery() query: SearchQuery) {
    // Now `query` is type-safe
    // because it has been validated and transformed into an instance of SearchQuery.
    const { title } = query

    return {
      ...
    }
  }
}
```

To know more, see `@handlerParam` api documentation below.

### Redirection, Rendering via pug and others...

Techinically, you don't have to access `res` to response data.
But, if you want to redirect or render page via pug, you need to access `res.redirect` or `res.render`.
Sadly, if you do, you have make mockup for `res`.

But, with tachijs, you can tackle this problem.

```ts
import { controller, httpGet, RedirectResult } from 'tachijs'

@controller('/')
class HomeController {
  @httpGet('/redirect')
  redirectToHome() {
    return new RedirectResult('/')
  }
}
```

Now, you can test your controller like the below example.

```ts
describe('HomeController#redirectToHome', () => {
  it('redirects to `/`', async () => {
    // Given
    const controller = new HomeController()

    // When
    const result = controller.redirectToHome()

    // Then
    expect(result).toBeInstanceOf(RedirectResult)
    expect(result).toMatchObject({
      location: '/'
    })
  })
})
```

There are other results too, `EndResult`, `JSONResult`, `RenderResult`, `SendFileResult`, `SendResult`, and `SendStatusResult`. Please see our api documentation below.

#### `BaseController`

If you need to use many types of result, you probably want `BaseController`.
Just import it once, and your controller can instantiate results easily.

```ts
import { controller, httpGet, BaseController } from 'tachijs'

@controller('/')
// You have to extend your controller from `BaseController`
class HomeController extends BaseController {
  @httpGet('/redirect')
  redirectToHome() {
    // This is identically same to `return new RedirectResult('/')`
    return this.redirect('/')
  }
}
```

`BaseController` has methods for all build-in results, Please see our api documentation below.

##### `BaseController#httpContext`

You may want to share some common methods via your own base controller. But, sadly, only methods, applied `httpGet`or `httpPost` kind, can use parameter decorators to access data from `req` or `res`.

To tackle this problems, we introduce `httpContext`. So tachijs will expose `req` and `res` via `httpContext` if your controller is extended from `BaseController`.

```ts
import { BaseController, controller, httpPost } from 'tachijs'

class MyBaseController extends BaseController {
  async getUserConfig() {
    // When unit testing, httpContext is not defined.
    if (this.httpContext == null) {
      return new UserConfig()
    }

    // Now we can get the current user
    const currentUser = this.httpContext.req.user

    return UserConfig.findOne({
      user: currentUser._id
    })
  }
}

@controller('/')
class HomeController {
  @httpGet('/settings')
  settings() {
    const userConfig = await this.getUserConfig()

    return this.render('settings', {
      userConfig
    })
  }
}
```

To test `HomeController#settings`...

```ts
describe('HomeController#settings', () => {
  it('renders userConfig', async () => {
    // Given
    const controller = new HomeController()
    const mockUserConfig = await UserConfig.create({...})
    // Replace method with mockup
    controller.getUserConfig = () => mockUserConfig

    // When
    const result = controller.settings()

    // Then
    expect(result).toMatch({
      locals: {
        userConfig: mockUserConfig
      }
    })
  })
})
```

#### Customize result

If you want to have customized result behavior, you can do it with `BaseResult`.
`BaseResult` is an abstract class which coerce you to define how to end the route by providing `execute` method.
(Every built-in result is extended from `BaseResult`.)

Let's see our implementation of `RedirectResult`.

```ts
import express from 'express'
import { BaseResult } from './BaseResult'

export class RedirectResult extends BaseResult {
  constructor(
    public readonly location: string,
    public readonly status?: number
  ) {
    super()
  }

  // tachijs will provide all what you need and execute this method.
  async execute(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    if (this.status != null) return res.redirect(this.status, this.location)
    return res.redirect(this.location)
  }
}
```

### Dependency injection

To make controllers more testable, tachijs provides dependency injection.

Let's think we have some mailing service, `MailerService`.
While developing or testing, we probably don't want our server to send real e-mail everytime.

```ts
import tachijs, {
  controller,
  httpGet,
  httpPost,
  reqBody,
  inject,
  BaseController
} from 'tachijs'

// Create enum for service types
enum ServiceTypes {
  EmailService = 'EmailService',
  NotificationService = 'NotificationService'
}

// Abstract class coerce MailerService must have `sendEmail` method.
abstract class MailerService {
  abstract sendEmail(content: string): Promise<void>
}

// Mockup service for development and testing.
class MockEmailService extends MailerService {
  async sendEmail(content: string) {
    console.log(`Not sending email.... content: ${content}`)
  }
}

class EmailService extends MailerService {
  async sendEmail(content: string) {
    console.log(`Sending email.... content: ${content}`)
  }
}

interface Container {
  [ServiceTypes.EmailService]: typeof MailerService
}

const envIsDev = process.env.NODE_ENV === 'development'

// Swapping container depends on the current environment.
const container: Container = envIsDev
  ? {
      // In development env, don't send real e-mail because we use mockup.
      [ServiceTypes.EmailService]: MockEmailService
    }
  : {
      [ServiceTypes.EmailService]: EmailService
    }

@controller('/')
class HomeController extends BaseController {
  constructor(
    // Inject MailerService. The controller will get the one registered to the current container.
    @inject(ServiceTypes.EmailService) private mailer: MailerService
  ) {
    super()
  }

  @httpGet('/')
  home() {
    return `<form action='/notify' method='post'><input type='text' name='message'><button>Notify</button></form>`
  }

  @httpPost('/email')
  async sendEmail(@reqBody() body: any) {
    await this.mailer.sendEmail(body.message)

    return this.redirect('/')
  }
}

const server = tachijs({
  controllers: [HomeController],
  // Register container
  container
})
```

So you can test `HomeController#sendEmail` like the below example.

```ts
describe('HomeController#sendEmail', () => {
  it('sends email', async () => {
    // Given
    const spyFn = jest.fn()
    class TestEmailService extends MailerService {
      async sendEmail(content: string): Promise<void> {
        spyFn(content)
      }
    }
    const controller = new HomeController(new TestEmailService())

    // When
    const result = controller.sendEmail('hello')

    // Then
    expect(spyFn).toBeCalledWith('hello')
  })
})
```

Now we don't have to worry that our controller sending e-mail for each testing.

Furthermore, you can inject other services to your service as long as they exist in the container.

```ts
class NotificationService {
  constructor(
    // When NotificationService is instantiated, MailerService will be instantiated also by tachijs.
    @inject(ServiceTypes.EmailService) private mailer: MailerService
  ) {}

  async notifyWelcome() {
    await this.mailer.sendEmail('Welcome!')
  }
}
```

### Bad practices

#### Execute `res.send` or `next` inside of controllers or `@handlerParam`

Please don't do that. It just make your controller untestable. If you want some special behaviors after your methods are executed, please try to implement them with `BaseResult`.

## APIs

### `tachijs(options: TachiJSOptions): express.Application`

Create and configure an express app.

#### `TachiJSOptions`

```ts
interface TachiJSOptions<C = {}> {
  app?: express.Application
  before?: ConfigSetter
  after?: ConfigSetter
  controllers?: any[]
  container?: C
}

type ConfigSetter = (app: express.Application) => void
```

- `app` Optional. If you provide this option, tachijs will use it rather than creating new one.
- `before` Optional. You can configure express app before registering controllers for applying middlewares.
- `after` Optional. You can configure express app before registering controllers for error handling.
- `controllers` Optional. Array of controller classes.
- `container` Optional. A place for registered services.
  If you want to use DI, you have to register services to here first.

### `@controller(path: string, middlewares: RequestHandler[] = [])`

It marks class as a controller.

- `path` target path.
- `middlewares` Optional. Array of middlewares.

### `@httpMethod(method: string, path: string, middlewares: RequestHandler[] = [])`

It marks method as a request handler.

- `method` target http methods, `'get'`, `'post'`, `'put'`, `'patch'`, `'delete'`, `'options'`, `'head'` or `'all'` are available. (`'all'` means any methods.)
- `path` target path.
- `middlewares` Optional. Array of middlewares.

tachijs also provides shortcuts for `@httpMethod`.

- `@httpGet(path: string, middlewares: RequestHandler[] = [])`
- `@httpPost(path: string, middlewares: RequestHandler[] = [])`
- `@httpPut(path: string, middlewares: RequestHandler[] = [])`
- `@httpPatch(path: string, middlewares: RequestHandler[] = [])`
- `@httpDelete(path: string, middlewares: RequestHandler[] = [])`
- `@httpOptions(path: string, middlewares: RequestHandler[] = [])`
- `@httpHead(path: string, middlewares: RequestHandler[] = [])`
- `@httpAll(path: string, middlewares: RequestHandler[] = [])`

### `@handlerParam<T>(selector: HandlerParamSelector<T>)`

- `selector` selects a property from `req`, `res`, `next` or even our `meta`

```ts
export type HandlerParamSelector<T> = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  meta: HandlerParamMeta<T>
) => T
```

```ts
interface HandlerParamMeta<T> {
  index: number
  selector: HandlerParamSelector<T>
  paramType: any
}
```

- `index` Number index of the parameter.
- `selector` Its selector.
- `paramType` metadata from `design:paramtypes`.

#### `@reqBody(validator?: any)`

Inject `req.body`.

- `validator` Optional. A class with decorators of `class-validator`. tachijs will validate `req.body` with it and transform `req.body` into the validator class. If `validator` is not given but the parameter has a class validator as its param type, tachijs will use it via `reflect-metadata`.

```ts
import { controller, httpPost, reqBody } from 'tachijs'

@controller('/post')
class PostController {
  @httpPost('/')
  // Identically same to `create(@reqBody(PostDTO) post: PostDTO)`
  create(@reqBody() post: PostDTO) {
    ...
  }
}
```

#### `@reqParams(paramName?: string)`

Inject `req.params` or its property.

- `paramName` If it is given, `req.params[paramName]` will be injected.

#### `@reqQuery(paramName?: string)`

Inject `req.query` or its property.

- `paramName` If it is given, `req.query[paramName]` will be injected.

#### `@reqHeaders(paramName?: string)`

Inject `req.headers` or its property.

- `paramName` If it is given, `req.headers[paramName]` will be injected.

#### `@reqCookies(paramName?: string)`

Inject `req.cookies` or its property.

- `paramName` If it is given, `req.cookies[paramName]` will be injected.

#### `@reqSignedCookies(paramName?: string)`

Inject `req.signedCookies` or its property.

- `paramName` If it is given, `req.signedCookies[paramName]` will be injected.

#### `@cookieSetter()`

Inject `res.cookie` method to set cookie.

#### `@cookieClearer()`

Inject `res.clearCookie` method to clear cookie.

#### `@reqSession(paramName?: string)`

Inject `req.session`.

### `BaseController`

A base for controller which have lots of helper methods for returning built-in results. Also, it allows another way to access properties of `req` and `res` without decorators.

- `#httpContext` tachijs will set `req` and `res` to this property. So, when unit testing, it is not defined.
- `#end(data: any, encoding?: string, status?: number): EndResult`
- `#json(data: any, status?: number): JSONResult`
- `#redirect(location: string, status?: number): RedirectResult`
- `#render(view: string, locals?: any, callback?: RenderResultCallback, status?: number): RenderResult`
- `#sendFile(filePath: string, options?: any, callback?: SendFileResultCallback, status?: number): SendFileResult`
- `#send(data: any, status?: number): SendResult`
- `#sendStatus(status: number): SendStatusResult`

### Results

#### `BaseResult`

All of result classes must be extended from `BaseResult` because tachijs can recognize results by `instanceof BaseResult`.

It has only one abstract method which must be defined by descendant classes.

- `execute(req: express.Request, res: express.Response, next: express.NextFunction): Promise<any>` tachijs will use this method to finalize response.

#### `new EndResult(data: any, encoding?: string, status: number = 200)`

tachijs will finalize response with `res.status(status).end(data, encoding)`.

#### `new JSONResult(data: any, status: number = 200)`

tachijs will finalize response with `res.status(status).json(data)`.

#### `new RedirectResult(location: string, status?: number)`

tachijs will finalize response with `res.redirect(location)` (or `res.redirect(status, location)` if the status is given).

#### `new RenderResult(view: string, locals?: any, callback?: RenderResultCallback, status: number = 200)`

tachijs will finalize response with `res.status(status).render(view, locals, (error, html) => callback(error, html, req, res, next))`

```ts
type RenderResultCallback = (
  error: Error | null,
  html: string | null,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => void
```

#### `new SendFileResult(filePath: string, options: any, callback?: SendFileResultCallback, status: number = 200)`

tachijs will finalize response with `res.status(status).sendFile(filePath, options, (error) => callback(error, req, res, next))`

```ts
type SendFileResultCallback = (
  error: Error | null,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => void
```

#### `new SendResult(data: any, status: number = 200)`

tachijs will finalize response with `res.status(status).send(data)`.

#### `new SendStatusResult(status: number)`

tachijs will finalize response with `res.sendStatus(status)`.

### `@inject(key: string)`

Inject a registered service in container by the given `key`.

## License

MIT © Junyoung Choi
