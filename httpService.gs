/**
 * A class representing an HTTP service
 */
class HttpService {
  /**
   * Constructs a new HttpService instance with the given options
   * 
   * @param {object} defaults The default options to use with each request
   * @param {array} interceptors An array of interceptor objects (ran after each request)
   * 
   * Supported Default Options:
   * {
   *    baseURL: "", // The base url to use for each request (combined with the given url)
   *    headers: {} // Default headers (added to each request)
   * }
   */
  constructor(defaults = {}, interceptors = []) {
    this.defaults = defaults;
    this.interceptors = interceptors;
  }

  /**
   * Appends an object of query parameters to a given url
   * 
   * @param {string} url The url to add query parameters to
   * @param {object} obj An object containing the query paramters to add
   * @return {string} A url with the given query parameters
   */
  urlAddQuery_(url, obj) {
    return url + "?" + Object.entries(obj).flatMap(([i, v]) => {
      if (Array.isArray(v)) {
        return v.map(entry => `${i}=${encodeURIComponent(entry)}`);
      } else {
        return `${i}=${encodeURIComponent(v)}`;
      }
    }).join("&");
  }

  /**
   * Makes an HTTP request to the specified url with the given options (merged with defaults)
   * 
   * @param {string} url The url to make to the request to
   * @param {object} options Additional options for the request (conforms to UrlFetchApp params)
   * @return {object} An HTTPResponse object
   */
  fetch_(url, options = {}) {
    if (this.defaults.baseURL) {
      const stripSlash = url => {
        const lastChar = url.charAt(url.length - 1);

        if (lastChar === "/") {
          return url.substring(0, url.length - 1);
        }

        return url;
      };

      url = stripSlash(this.defaults.baseURL) + "/" + stripSlash(url);
    }

    if (this.defaults.headers) {
      options.headers = {
        ...this.defaults.headers,
        ...options.headers
      };
    }

    if (options.params) {
      url = this.urlAddQuery_(url, options.params);
    }

    if (options.payload) {
      options.payload = JSON.stringify(options.payload);
    }

    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      contentType: "application/json",
      ...options
    });

    const body = res.getContentText();
    const status = res.getResponseCode();

    let json;

    try {
      
      json = JSON.parse(body);
      
    } catch {
      json = {
        status,
        body
      };
    }

    for (const interceptor of this.interceptors) {
      if (status === 200 && interceptor?.response?.success) {
        interceptor.response.success(json);
      } else if (status !== 200 && interceptor?.response?.error) {
        interceptor.response.error({
          config: {
            url,
            ...options
          },
          response: json
        });
      }
    }

    return json;
  }

  /**
   * Makes a GET request to the specified url with the given options
   * 
   * @param {object} options The UrlFetchApp params to use for the request
   * @return {object} An HTTPResponse object
   */
  get(url, options = {}) {
    options.method = "get";

    return this.fetch_(url, options);
  }

  /**
   * Makes a POST request to the specified url with the given options
   * 
   * @param {object} options The UrlFetchApp params to use for the request
   * @return {object} An HTTPResponse object
   */
  post(url, options = {}) {
    options.method = "post";

    return this.fetch_(url, options);
  }
}
