# codeceptjs-httpmock

codeceptjs-httpmock is [CodeceptJS](https://codecept.io/) helper which wraps [mockttp](https://www.npmjs.com/package/@kronoslive/mockttp) library to manage http mock in tests.

NPM package: https://www.npmjs.com/package/codeceptjs-httpmock

### Configuration

This helper should be configured in codecept.json/codecept.conf.js

-   `port`: mock port. Default `9037`
-   `debug`: - (optional) enable debug logs. Default `false`

Example:

```json
{
   "helpers": {
     "HTTPMock" : {
       "require": "codeceptjs-httpmock",
       "debug": false,
       "port": 9037
     }
   }
}
```

## respondWith

Set up mock for method и urlPath. Response calculates in callback function.

```js
  I.respondWith('POST', '/url', (req) => {
    if (req.body.status === 'good') {
      return { status: 200, body: '{"Status":"OK"}', headers: { 'Content-Type': 'application/json' } };
    }
    return { status: 400, body: { error: 'badman' } }
  });
```

**Parameters**

-   `method` - request method
-   `urlPath` - relative path for mock
-   `callback` - (optional) callback function. Should return response object
-   `ctx` - (optional) mockttp context

## expectRequestUntil

Validates that request comes for method and urlpath that satisfies predicate function

```js
I.expectRequestUntil('POST', '/myPath', req =>
    req.body.json.param === 'myValue'
  );
```

**Parameters**

-   `method` - request method
-   `urlPath` - relative path for mock
-   `predicate` - (optional) specify predicate function. Predicate function should return `true` value.
-   `timeout` - (optional) timeout in ms. After the end of the timeout method will throw Error

## dontExpectRequestUntil

Validates that no request comes for method and urlpath that satisfies predicate function

```js
I.dontExpectRequestUntil('POST', '/myPath', req =>
    req.body.json.param === 'myValue'
  );
```

**Parameters**

-   `method` - request method
-   `urlPath` - relative path for mock
-   `predicate` - (optional) specify predicate function. Predicate function should return `false` value.
-   `timeout` - (optional) timeout in ms. After this timeout helper will check that there were no requests

## grabServerRequests

Get requests that comes to mock server by method and urlPath

```js
let requests = await I.grabServerRequests('POST', '/myPath');
```

**Parameters**

-   `method` - request method
-   `urlPath` - relative path for mock
