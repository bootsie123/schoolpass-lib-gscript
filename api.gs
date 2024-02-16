const configURL_ = "https://schoolpass.cloud/assets/runtime.config.json";

const http_ = new HttpService();

/**
 * A class for interacting with the School Pass API
 */
class SchoolPassAPI {
  /**
   * Constructions an instance of SchoolPassAPI using the given options
   * 
   * @param {object} options An object containing the config options
   * 
   * Options:
   * {
   *    debug: false // When true, debug information is logged to the console
   * }
   */
  constructor(options = {}) {
    this.options = options;
    this.debug = options.debug;

    try {
      this.initService_();
    } catch (err) {
      if (this.debug) {
        console.error("An error has occured while trying to initialize the School Pass API", err);
      }
    }
  }

  /**
   * Intercepts HTTP requests and handles expired authentication and rate limiting
   * 
   * @param {object} err An error object from the failed HTTP request
   * @return {object} The results of the retried HTTP request
   */
  authInterceptor_(err) {
    const originalReq = err.config;

    err.response.status = 401;

    if (err.response.status === 401 && !originalReq._retry) {
      originalReq._retry = true;

      if (this.debug) {
        console.warn("Authentication token possibly expired. Auto refreshing token...");
      }

      try {
        const token = this.authenticate(
          this.schoolCode,
          this.user.userType,
          this.user.internalId,
          this.hashPassword_(password)
        );

        originalReq.headers.Token = token;

        return this.schoolConnect.fetch_(originalReq.url, originalReq);
      } catch {
        if (this.debug) {
          console.error("Unable to auto refresh authentication token");
        }
      }
    } else if (err.response.status === 429) {
      const retryAfter = parseInt(originalReq.headers["retry-after"]) + 3;

      if (this.debug) {
        console.warn(`Rate limit reached. Retrying after ${retryAfter} seconds`);
      }

      Utilities.sleep(retryAfter * 1000);

      return this.schoolConnect.fetch_(originalReq.url, originalReq);
    }

    throw err;
  }

  /**
   * Initializes the necessary HTTP services and authenticates the user
   */
  initService_() {
    const username = this.options.username;
    const password = this.options.password;

    const urlData = http_.get(configURL_);

    this.homebase = new HttpService({
      baseURL: urlData.defaultHomeBaseUrl,
      headers: {
        Authorization: `Bearer ${urlData.authToken}`
      }
    });

    const connectionInfo = this.findUserInfo(username)[0];

    this.schoolCode = connectionInfo.schoolConnection.appCode;

    this.schoolConnect = new HttpService({
      baseURL: connectionInfo.schoolConnection.apiUrl + "/api",
      headers: {
        Authorization: `Bearer ${urlData.authToken}`,
        Appcode: `${this.schoolCode}`
      },
    }, [
      {
        response: {
          error: err => this.authInterceptor_
        }
      }
    ]);

    const hash = this.hashPassword_(password);

    const userInfo = this.getAuthenticatingUser(
      connectionInfo.schoolConnection.appCode,
      username,
      hash
    )[0];

    this.user = userInfo;

    const token = this.authenticate_(
      this.schoolCode,
      userInfo.userType,
      userInfo.internalId,
      hash
    );

    this.schoolConnect.defaults.headers = {
      Token: token,
      ...this.schoolConnect.defaults.headers
    };
  }

  /**
   * Encodes the given password using an SHA1 hash
   * 
   * @param {string} password The password to encode
   * @return {string} The hash encoded in BASE64
   */
  hashPassword_(password) {
    const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, password);

    return Utilities.base64Encode(rawHash);
  }

  /**
   * Authenticates a user with the given school code, user type, user ID, and password
   * 
   * @param {number} schoolCode The school code of the given user
   * @param {number} userType The account type of the given user
   * @param {number} userId The ID of the given user
   * @param {string} password The password of the given user
   * @return {string} An access token on successful authentication
   */
  authenticate_(schoolCode, userType, userId, password) {
    try {
      const res = this.schoolConnect.post("User/Login", {
        params: {
          schoolCode,
          userType,
          userId,
          password
        }
      });

      return res.body;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Retrieves information on the current user trying to authenticate
   * 
   * @param {number} schoolCode The school code attached to the user
   * @param {string} username The username of the authenticating user
   * @param {string} password The password of the authenticating user
   * @return {object} An object with user information
   */
  getAuthenticatingUser(schoolCode, username, password) {
    try {
      const res = this.schoolConnect.get("User", {
        params: {
          schoolCode,
          login: username,
          password
        }
      });

      return res;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Retrieves user information using the given email address
   * 
   * @param {string} email The email address of the user being retrieved
   * @return {object} Information on the user
   */
  findUserInfo(email) {
    try {
      const res = this.homebase.get("findspruserinfo", {
        params: {
          emailAddress: email
        }
      });

      return res;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Retrieves the attendance status for all dismissal locations
   * 
   * @return {array} An array of the attendance status for each dismissal location
   */
  attendanceStatus() {
    try {
    const res = this.schoolConnect.get("classroom/getAllAttendanceInfo");
    

      return res;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Retrieves a list of all activities and their associated data
   * 
   * @return {array} An array of activity
   */
  getActivities() {
    try {
    const res = this.schoolConnect.get("activity/getAllActivities");
    

      return res;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Runs the Activity Attendance report
   * 
   * @param {string} schoolCode The code of the school
   * @param {string} fromDate The start date for the report (format "yyyy-mm-dd")
   * @param {string} toDate The end date for the report (format "yyyy-mm-dd")
   * @param {array} activityIds An array of activity IDs to include in the report - defaults to all
   * @param {array} gradeIDs An array of grade IDs to include in the report - defaults to all
   * @param {string} sitePrefix The prefix for the school - defaults to "SCH1"
   * 
   * @return {array} An array of activity
   */
  runActivityAttendanceReport(
    schoolCode,
    fromDate,
    toDate,
    activityIds = [],
    gradeIDs = [],
    sitePrefix = "SCH1",
  ) {
    try {
      const res = this.schoolConnect.post("v2/Reports/ActivityAttendanceReport", {
        params: {
          schoolCode
        },
        payload: {
          activities: activityIds.join(","),
          sitePrefix,
          fromDate,
          toDate,
          grades: gradeIDs.join(",")
        }
      });
      

        return res;
      } catch (err) {
        throw err;
      }
    }
    
}

/**
 * A helper function for end users to create a new instance
 * of the SchoolPassAPI
 * 
 * @param {object} args Arguments for the SchoolPassAPI
 * @return {object} A new instance of the SchoolPassAPI
 */
function init(...args) {
  return new SchoolPassAPI(...args);
}
