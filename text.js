
const express = require("express");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Api } = require("telegram/tl");
const cors = require("cors");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const input = require("input"); 
const mongoose = require("mongoose"); // Import Mongoose for MongoDB



mongoose.connect("mongodb+srv://telegram:telegram1234@cluster0.dtoi1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4
}).then(() => {
  console.log("Successfully connected to MongoDB.");
}).catch((error) => {
  console.log("MongoDB connection error:", error);
  // Implement retry logic if needed
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});
const UserSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, unique: true },
  sessionToken: { type: String, required: true },
  sessionData: { type: String, required: true },
  firstName: String,
  lastName: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);


const app = express();
const apiId = 22195259;
const apiHash = "01b3e6454d012c1cd697fb99951e251e";

// In-memory session storage
const sessionStore = new Map();

class TelegramAuthService {
  constructor() {
    this.client = null;
    this.phoneCodeHash = null;
    this.session = new StringSession("");
  }

  // async initializeClient(phoneNumber) {
  //   try {
  //     if (!phoneNumber || typeof phoneNumber !== 'string') {
  //       throw new Error('Invalid phone number format');
  //     }

  //     const formattedPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

  //     this.client = new TelegramClient(this.session, apiId, apiHash, {
  //       connectionRetries: 5,
  //       useWSS: false
  //     });

  //     await this.client.connect();

  //     const sendCodeResult = await this.client.invoke(
  //       new Api.auth.SendCode({
  //         phoneNumber: formattedPhoneNumber,
  //         apiId: apiId,
  //         apiHash: apiHash,
  //         settings: new Api.CodeSettings({})
  //       })
  //     );

  //     this.phoneCodeHash = sendCodeResult.phoneCodeHash;
  //     return { status: 'success', phoneCodeHash: this.phoneCodeHash };
  //   } catch (error) {
  //     console.error("Client Initialization Error:", error);
  //     throw error;
  //   }
  // }

  async initializeClient(phoneNumber) {
    try {
      if (!phoneNumber || typeof phoneNumber !== "string") {
        throw new Error("Invalid phone number format");
      }

      const formattedPhoneNumber = phoneNumber.startsWith("+")
        ? phoneNumber
        : `+${phoneNumber}`;

      this.client = new TelegramClient(this.session, apiId, apiHash, {
        connectionRetries: 5,
        useWSS: false,
      });

      await this.client.connect();

      const sendCodeResult = await this.client.invoke(
        new Api.auth.SendCode({
          phoneNumber: formattedPhoneNumber,
          apiId: apiId,
          apiHash: apiHash,
          settings: new Api.CodeSettings({}),
        })
      );

      this.phoneCodeHash = sendCodeResult.phoneCodeHash;
      return { status: "success", phoneCodeHash: this.phoneCodeHash };
    } catch (error) {
      console.error("Client Initialization Error:", error);
      throw error;
    }
  }

  async generateQR() {
    try {
      console.log("Starting QR code generation...");
      
      // Create a new client instance for each QR code generation
      const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
        connectionRetries: 5,
        useWSS: false, // Try with false first
      });

      await client.connect();
      console.log("Client connected successfully");

      return new Promise((resolve, reject) => {
        let timeoutId;
        
        const qrCodePromise = client.signInUserWithQrCode(
          { apiId, apiHash },
          {
            qrCode: (qrCode) => {
              try {
                console.log("QR code token generated");
                const loginToken = Buffer.from(qrCode.token).toString('base64url');
                const sessionToken = crypto.randomBytes(32).toString('hex');
                
                // Store the session
                sessionStore.set(sessionToken, {
                  session: client.session.save(),
                  client: client
                });

                // Clear timeout as we got the QR code
                if (timeoutId) {
                  clearTimeout(timeoutId);
                }

                resolve({
                  loginLink: `tg://login?token=${loginToken}`,
                  sessionToken: sessionToken
                });
              } catch (error) {
                console.error("Error in QR callback:", error);
                reject(error);
              }
              return true;
            },
            onError: (error) => {
              console.error("QR code error:", error);
              reject(error);
              return true;
            }
          }
        );

        // Set a timeout for the QR code generation
        timeoutId = setTimeout(() => {
          reject(new Error("QR code generation timed out"));
          client.disconnect();
        }, 30000); // 30 second timeout
      });
    } catch (error) {
      console.error("QR Generation Error:", error);
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }


  // async validateOTP(phoneNumber, otp, phoneCodeHash) {
  //   try {
  //     if (!phoneNumber || !otp || !phoneCodeHash) {
  //       throw new Error('Missing required authentication parameters');
  //     }

  //     const formattedPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

  //     const validationClient = new TelegramClient(this.session, apiId, apiHash, {
  //       connectionRetries: 5
  //     });

  //     await validationClient.connect();

  //     const signInResult = await validationClient.invoke(
  //       new Api.auth.SignIn({
  //         phoneNumber: formattedPhoneNumber,
  //         phoneCodeHash: phoneCodeHash,
  //         phoneCode: otp
  //       })
  //     );

  //     const sessionToken = crypto.randomBytes(32).toString('hex');
      
  //     sessionStore.set(sessionToken, {
  //       session: validationClient.session.save(),
  //       client: validationClient
  //     });

  //     return {
  //       status: 'success',
  //       sessionToken: sessionToken,
  //       user: signInResult.user ? {
  //         id: signInResult.user.id,
  //         firstName: signInResult.user.firstName,
  //         lastName: signInResult.user.lastName
  //       } : null
  //     };
  //   } catch (error) {
  //     console.error("OTP Validation Error:", error);
  //     throw error;
  //   }
  // }

  async validateOTP(phoneNumber, otp, phoneCodeHash) {
    try {
      if (!phoneNumber || !otp || !phoneCodeHash) {
        throw new Error("Missing required authentication parameters");
      }

      const formattedPhoneNumber = phoneNumber.startsWith("+")
        ? phoneNumber
        : `+${phoneNumber}`;

      const validationClient = new TelegramClient(this.session, apiId, apiHash, {
        connectionRetries: 5,
      });

      await validationClient.connect();

      const signInResult = await validationClient.invoke(
        new Api.auth.SignIn({
          phoneNumber: formattedPhoneNumber,
          phoneCodeHash: phoneCodeHash,
          phoneCode: otp,
        })
      );

      const sessionToken = crypto.randomBytes(32).toString("hex");

      // Save user data to MongoDB
      const user = new User({
        phoneNumber: formattedPhoneNumber,
        sessionToken: sessionToken,
        sessionData: validationClient.session.save(),
        firstName: signInResult.user?.firstName || null,
        lastName: signInResult.user?.lastName || null,
      });

      await user.save();

      return {
        status: "success",
        sessionToken: sessionToken,
        user: signInResult.user
          ? {
              id: signInResult.user.id,
              firstName: signInResult.user.firstName,
              lastName: signInResult.user.lastName,
            }
          : null,
      };
    } catch (error) {
      console.error("OTP Validation Error:", error);
      throw error;
    }
  }



  // async getAuthenticatedClient(sessionToken) {
  //   try {
  //     console.log("Getting authenticated client for session:", sessionToken);
  //     const sessionData = sessionStore.get(sessionToken);
      
  //     if (!sessionData) {
  //       console.log("No session data found for token:", sessionToken);
  //       throw new Error('Invalid session');
  //     }

  //     const client = new TelegramClient(
  //       new StringSession(sessionData.session),
  //       apiId,
  //       apiHash,
  //       {
  //         connectionRetries: 5,
  //         useWSS: false
  //       }
  //     );

  //     await client.connect();
  //     return client;
  //   } catch (error) {
  //     console.error("Error getting authenticated client:", error);
  //     throw error;
  //   }
  // }

  async getAuthenticatedClient(sessionToken) {
    try {
      console.log("Getting authenticated client for session:", sessionToken);
      const user = await User.findOne({ sessionToken });

      if (!user) {
        console.log("No user found for token:", sessionToken);
        throw new Error("Invalid session");
      }

      const client = new TelegramClient(
        new StringSession(user.sessionData),
        apiId,
        apiHash,
        {
          connectionRetries: 5,
          useWSS: false,
        }
      );

      await client.connect();
      return client;
    } catch (error) {
      console.error("Error getting authenticated client:", error);
      throw error;
    }
  }


  // async checkSession(sessionToken) {
  //   try {
  //     console.log("Checking session for token:", sessionToken);
  //     if (!sessionToken) {
  //       console.log("No session token provided");
  //       return { isActive: false };
  //     }

  //     const client = await this.getAuthenticatedClient(sessionToken);
  //     const isAuthorized = await client.isUserAuthorized();
  //     console.log("Session authorization status:", isAuthorized);
      
  //     return { isActive: isAuthorized };
  //   } catch (error) {
  //     console.error("Session check error:", error);
  //     return { isActive: false };
  //   }
  // }
  
  async checkSession(sessionToken) {
    try {
      console.log("Checking session for token:", sessionToken);
      if (!sessionToken) {
        console.log("No session token provided");
        return { isActive: false };
      }

      const client = await this.getAuthenticatedClient(sessionToken);
      const isAuthorized = await client.isUserAuthorized();
      console.log("Session authorization status:", isAuthorized);

      return { isActive: isAuthorized };
    } catch (error) {
      console.error("Session check error:", error);
      return { isActive: false };
    }
  }


}

app.use(cors({
  origin: '*', 
  // credentials: true
}));
app.use(bodyParser.json());

const telegramAuthService = new TelegramAuthService();


app.get('/generate-qr', async (req, res) => {
  try {
    console.log("Received QR code generation request");
    const result = await telegramAuthService.generateQR();
    console.log("QR code generated successfully:", result);
    res.json(result);
  } catch (error) {
    console.error("Failed to generate QR code:", error);
    res.status(500).json({
      error: 'Failed to generate QR code',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.get('/check-session', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("Received check session request with auth header:", authHeader);

    if (!authHeader) {
      console.log("No authorization header provided");
      return res.json({ isActive: false });
    }

    const sessionToken = authHeader.split(' ')[1];
    console.log("Extracted session token:", sessionToken);

    const result = await telegramAuthService.checkSession(sessionToken);
    console.log("Session check result:", result);

    res.json(result);
  } catch (error) {
    console.error("Error checking session:", error);
    res.status(500).json({ 
      error: 'Failed to check session',
      message: error.message
    });
  }
});

// Add a debug endpoint to view active sessions
app.get('/debug/sessions', (req, res) => {
  const sessions = Array.from(sessionStore.keys());
  res.json({
    activeSessions: sessions.length,
    sessions: sessions
  });
});



app.post("/send-otp", async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const result = await telegramAuthService.initializeClient(phoneNumber);
    res.json({
      status: "success",
      message: "OTP sent successfully",
      phoneCodeHash: result.phoneCodeHash,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to send OTP",
    });
  }
});

app.post("/validate-otp", async (req, res) => {
  try {
    const { phoneNumber, otp, phoneCodeHash } = req.body;
    const result = await telegramAuthService.validateOTP(
      phoneNumber,
      otp,
      phoneCodeHash
    );
    res.json({
      status: "success",
      message: "OTP validated successfully",
      sessionToken: result.sessionToken,
      user: result.user,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error.message || "Invalid OTP",
    });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});







