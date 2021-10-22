(() => {
  // node_modules/onfetch/build/InterceptRule.js
  var splitSearchAndHash = (url) => {
    const matchResult = /^(.*?)(\?.*?)?(#.*)?$/.exec(url);
    if (!matchResult) {
      throw new Error("Failed to split search and hash from the input", {
        cause: url
      });
    }
    const [, path, search, hash] = matchResult;
    return [path, search, hash];
  };
  var InterceptRule = class {
    constructor(input, init = {}) {
      Object.defineProperty(this, "input", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: void 0
      });
      Object.defineProperty(this, "init", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: void 0
      });
      Object.defineProperty(this, "headersArr", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: void 0
      });
      Object.defineProperty(this, "delayDuration", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: 0
      });
      Object.defineProperty(this, "restApplyTimes", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: 1
      });
      this.input = input;
      this.init = init;
      let headers;
      if (init.headers) {
        headers = new Headers(init.headers);
      } else if (input instanceof Request) {
        headers = input.headers;
      } else {
        headers = [];
      }
      this.headersArr = [...headers];
    }
    delay(ms) {
      this.delayDuration += ms;
      return this;
    }
    redirect(url) {
      this.redirection = url;
      return this;
    }
    reply(replier, init) {
      if (replier === void 0 || init) {
        this.replier = new Response(replier, init);
      } else {
        this.replier = replier;
      }
      return this;
    }
    isActive() {
      return this.restApplyTimes > 0;
    }
    times(n) {
      this.restApplyTimes = n;
      return this;
    }
    once() {
      return this.times(1);
    }
    twice() {
      return this.times(2);
    }
    thrice() {
      return this.times(3);
    }
    persist() {
      return this.times(Infinity);
    }
    test(input, init) {
      if (!this.isActive())
        return false;
      const request = init === void 0 && input instanceof Request ? input : new Request(input, init);
      let requiredInit = this.init;
      if (this.input instanceof Request) {
        requiredInit = new Request(this.input, this.init);
      } else if (this.input instanceof RegExp) {
        if (!this.input.test(request.url))
          return false;
      } else {
        const [path, search, hash] = splitSearchAndHash(request.url);
        const [requiredPath, requiredSearch, requiredHash] = splitSearchAndHash(new URL(this.input, request.url).href);
        if (path !== requiredPath)
          return false;
        if (requiredSearch && search !== requiredSearch || requiredHash && hash !== requiredHash)
          return false;
      }
      const { body, headers, window, ...rest } = requiredInit;
      if (this.headersArr.some(([key, value]) => request.headers.get(key) !== value)) {
        return false;
      }
      return Object.entries(rest).every(([key, value]) => request[key] === value);
    }
    async apply(request, fetchers) {
      this.restApplyTimes -= 1;
      const { replier, delayDuration, redirection } = this;
      if (replier === void 0) {
        throw new Error("No reply body or callback configured on this onfetch rule", {
          cause: this
        });
      }
      if (delayDuration > 0)
        await new Promise((r) => setTimeout(r, delayDuration));
      const parsedRequest = redirection ? new Request(redirection, request) : request;
      const bodyInitOrResponse = typeof replier === "function" ? await replier(parsedRequest, fetchers) : replier;
      const response = bodyInitOrResponse instanceof Response ? bodyInitOrResponse.clone() : new Response(bodyInitOrResponse);
      if (!response.url) {
        Object.defineProperty(response, "url", {
          value: parsedRequest.url.split("#", 1)[0]
        });
      }
      if (redirection && !response.redirected) {
        Object.defineProperty(response, "redirected", {
          value: true
        });
      }
      return response;
    }
  };

  // node_modules/onfetch/build/AbortError.js
  var message = "The user aborted a request.";
  var AbortError = class extends Error {
    constructor() {
      super(message);
      Object.defineProperty(this, "name", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: "AbortError"
      });
    }
  };
  var ParsedAbortError = (() => {
    if (typeof DOMException !== "undefined") {
      return DOMException.bind(null, message, "AbortError");
    }
    return AbortError;
  })();
  var AbortError_default = ParsedAbortError;

  // node_modules/onfetch/build/Fetcher.js
  var Fetcher = class {
    constructor(context) {
      Object.defineProperty(this, "options", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: {
          defaultRule: new InterceptRule("").reply((request) => {
            throw new Error("No onfetch rule matches this fetch request", {
              cause: request
            });
          }),
          AbortError: AbortError_default
        }
      });
      Object.defineProperty(this, "rules", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: []
      });
      Object.defineProperty(this, "context", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: void 0
      });
      Object.defineProperty(this, "original", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: void 0
      });
      Object.defineProperty(this, "mocked", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: async (...argArray) => {
          const request = new Request(...argArray);
          const { signal } = request;
          if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
            throw new this.options.AbortError();
          }
          const applyPromise = (this.rules.find((rule) => rule.test(request)) || this.options.defaultRule).apply(request, {
            original: this.original,
            mocked: this.mocked
          });
          if (signal) {
            return Promise.race([
              applyPromise,
              new Promise((resolve, reject) => {
                signal.addEventListener("abort", () => {
                  reject(new this.options.AbortError());
                });
              })
            ]);
          }
          return applyPromise;
        }
      });
      Object.defineProperty(this, "addRule", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: (input, init = {}) => {
          const rule = new InterceptRule(input, init);
          this.rules.push(rule);
          return rule;
        }
      });
      Object.defineProperty(this, "hasActive", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: () => this.rules.some((rule) => rule.isActive())
      });
      Object.defineProperty(this, "isActive", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: () => this.context.fetch === this.mocked
      });
      Object.defineProperty(this, "deactivate", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: () => {
          this.context.fetch = this.original;
        }
      });
      Object.defineProperty(this, "activate", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: () => {
          this.context.fetch = this.mocked;
        }
      });
      Object.defineProperty(this, "config", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: (config) => {
          Object.assign(this.options, config);
        }
      });
      this.context = context;
      this.original = context.fetch;
    }
  };

  // node_modules/onfetch/build/core.js
  var mockFetchOn = (context) => {
    const { addRule, hasActive, isActive, deactivate, activate, config } = new Fetcher(context);
    return Object.assign(addRule, {
      hasActive,
      isActive,
      deactivate,
      activate,
      config
    });
  };
  var core_default = mockFetchOn;

  // node_modules/onfetch/build/index.js
  var onfetch = core_default(globalThis);
  onfetch.activate();
  var build_default = onfetch;

  // node_modules/playwright-fixtures/dist/index.js
  var prepareFixtures = async (base, init) => {
    const extend = {};
    let useResolve;
    let usePromise;
    await new Promise((construct) => {
      usePromise = new Promise((resolve) => {
        useResolve = resolve;
        construct();
      });
    });
    const finishJobs = [];
    const prepareJobs = Object.entries(init).map(([key, fixtureValue]) => new Promise((prepareValueResolve) => {
      if (typeof fixtureValue === "function") {
        const useValue = async (value) => {
          extend[key] = value;
          prepareValueResolve();
          await usePromise;
        };
        finishJobs.push(Promise.resolve(fixtureValue({ ...base, ...extend }, useValue)).then(prepareValueResolve));
      } else {
        extend[key] = fixtureValue;
        prepareValueResolve();
      }
    }));
    await Promise.all(prepareJobs);
    return [{ ...base, ...extend }, useResolve, finishJobs];
  };
  var wrapTest = (baseTest, fixturesList) => new Proxy(baseTest, {
    apply: (target, thisArg, [name, inner]) => target.call(thisArg, name, async (...baseTestArgs) => {
      const finishList = [];
      const fixtures = await fixturesList.reduce(async (initializing, init) => {
        const [initialized, finishFunc, finishJobs] = await prepareFixtures(await initializing, init);
        finishList.push([finishFunc, finishJobs]);
        return initialized;
      }, Promise.resolve({}));
      try {
        await inner.call(thisArg, fixtures, ...baseTestArgs);
      } finally {
        await finishList.reduceRight(async (finishing, [finishFunc, finishJobs]) => {
          await finishing;
          finishFunc();
          await Promise.all(finishJobs);
        }, Promise.resolve());
      }
    }),
    get(target, key) {
      if (key === "extend") {
        return (fixtures) => wrapTest(baseTest, [...fixturesList, fixtures]);
      }
      return target[key];
    }
  });
  var wrap = (baseTest) => wrapTest(baseTest, []);
  var dist_default = wrap;
})();
//# sourceMappingURL=bundle.js.map
