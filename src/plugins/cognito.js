import { Config, CognitoIdentityCredentials } from "aws-sdk";
import {
 CognitoUser,
  CognitoUserPool,
  AuthenticationDetails,
  CognitoUserAttribute
} from "amazon-cognito-identity-js";
// import { ConfigurationServicePlaceholders } from "aws-sdk/lib/config_service_placeholders";
import store from '@/store'

function CognitoAuth(config) {
  this.userSession = null;
  console.log('plugin instance...')
  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('[CognitoAuth error] valid option object required')
  }
  this.userPool = new CognitoUserPool({
    UserPoolId: config.UserPoolId,
    ClientId: config.ClientId
  })
  Config.region = config.region
  Config.UserPoolId = config.UserPoolId
  Config.credentials = new CognitoIdentityCredentials({
    IdentityPoolId: config.IdentityPoolId
  })
  this.options = config
}

CognitoAuth.prototype.signup = function (username, email, pass, cb) {
  let attributeList = [
      new CognitoUserAttribute({
          Name: 'email',
          Value: email
      })
  ]

  this.userPool.signUp(username, pass, attributeList, null, cb)
}

CognitoAuth.prototype.isAuthenticated = function (cb) {
  let cognitoUser = this.getCurrentUser()
  if (cognitoUser != null) {
      cognitoUser.getSession((err, session) => {
      if (err) {
          return cb(err, false)
      }
      console.log(session)
      return cb(null, true)
      })
  } else {
      cb(null, false)
  }
}

CognitoAuth.prototype.getCurrentUser = function () {
  return this.userPool.getCurrentUser()
}

CognitoAuth.prototype.forgotPassword = function(username, cb) {
  let userData = { Username: username, Pool: this.userPool }
  let cognitoUser = new CognitoUser(userData)

  cognitoUser.forgotPassword({
    onSuccess: function (result) {
      cb(null, result)
    },
    onFailure: function (err) {
      cb(err);
    },        
    inputVerificationCode() {
      var verificationCode = prompt('Please input verification code ' ,'');
      var newPassword = prompt('Enter new password ' ,'');
      console.log(`New password: ${newPassword}`)
      cognitoUser.confirmPassword(verificationCode, newPassword, this);
    }  
  })
}

CognitoAuth.prototype.authenticate  = function(username, pass, cb) {
  let authenticationData = { Username: username, Password: pass }
  let authenticationDetails = new AuthenticationDetails(authenticationData)
  let userData = { Username: username, Pool: this.userPool }
  let cognitoUser = new CognitoUser(userData)

  cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: function (result) {
          let accessToken = result.getAccessToken().getJwtToken()
          console.log('access token + ' + accessToken)
          var logins = {}
          logins['cognito-idp.' + Config.region + '.amazonaws.com/' + Config.UserPoolId] = accessToken
          console.log(logins)

          Config.credentials = new CognitoIdentityCredentials({
              IdentityPoolId: Config.UserPoolId,
              Logins: logins
          })
          console.log(Config.credentials)
          store.commit("auth/setUserAuthenticated", {
            accessToken: accessToken,
            userData: userData
          })
          // this.onChange(true)
          cb(null, result)
      },
      onFailure: function (err) {
          cb(err);
      },
      newPasswordRequired: function (userAttributes, requiredAttributes) {
          console.log(userAttributes, requiredAttributes)
          console.log('New Password Is Required')
      }
  })
}

CognitoAuth.prototype.getCurrentUser = function () {
  return this.userPool.getCurrentUser()
}

CognitoAuth.prototype.confirmRegistration = function (username, code, cb) {
  let cognitoUser = new CognitoUser({
      Username: username,
      Pool: this.userPool
  })
  cognitoUser.confirmRegistration(code, true, cb)
}

/**
* Logout of your cognito session.
*/
CognitoAuth.prototype.logout = function () {
  this.getCurrentUser().signOut()
  store.commit("auth/clearAuthentication")
  // this.onChange(false)
}

/**
* Resolves the current token based on a user session. If there
* is no session it returns null.
* @param {*} cb callback
*/
CognitoAuth.prototype.getIdToken = function (cb) {
  if (this.getCurrentUser() == null) {
      return cb(null, null)
  }
  this.getCurrentUser().getSession((err, session) => {
      if (err) return cb(err)
      if (session.isValid()) {
      return cb(null, session.getIdToken().getJwtToken())
      }
      cb(Error('Session is invalid'))
  })
}

CognitoAuth.prototype.install = function (app) {
  console.log(this.userSession)
  app.cognitoAuth = this;

  app.config.globalProperties.$cognitoAuth = this;
}

export function createCognitoPlugin(data) {
  return new CognitoAuth(data);
}
