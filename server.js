// const { TelegramClient } = require("telegram");
// const { StringSession } = require("telegram/sessions");
// const { Api } = require("telegram/tl");
// const express = require("express");
// const cors = require("cors");
// const bodyParser = require("body-parser");
// const crypto = require("crypto");

// const apiId = 22195259;
// const apiHash = "01b3e6454d012c1cd697fb99951e251e";

// // In-memory session storage (replace with a database in production)
// const sessionStore = new Map();

// class TelegramAuthService {
//   constructor() {
//     this.client = null;
//     this.phoneCodeHash = null;
//     this.session = new StringSession("");
//   }

//   async initializeClient(phoneNumber) {
//     try {
//       // Strict validation
//       if (!phoneNumber || typeof phoneNumber !== 'string') {
//         throw new Error('Invalid phone number format');
//       }

//       // Ensure international format
//       const formattedPhoneNumber = phoneNumber.startsWith('+') 
//         ? phoneNumber 
//         : `+${phoneNumber}`;

//       // Create client with explicit configuration
//       this.client = new TelegramClient(this.session, apiId, apiHash, {
//         connectionRetries: 5,
//         useWSS: false
//       });

//       // Connect client
//       await this.client.connect();

//       // Send code using Api method
//       const sendCodeResult = await this.client.invoke(
//         new Api.auth.SendCode({
//           phoneNumber: formattedPhoneNumber,
//           apiId: apiId,
//           apiHash: apiHash,
//           settings: new Api.CodeSettings({})
//         })
//       );

//       // Store phone code hash
//       this.phoneCodeHash = sendCodeResult.phoneCodeHash;

//       return {
//         status: 'success',
//         phoneCodeHash: this.phoneCodeHash
//       };

//     } catch (error) {
//       console.error("Client Initialization Error:", error);
//       throw error;
//     }
//   }

//   async validateOTP(phoneNumber, otp, phoneCodeHash) {
//     try {
//       // Validation checks
//       if (!phoneNumber || !otp || !phoneCodeHash) {
//         throw new Error('Missing required authentication parameters');
//       }

//       // Ensure international format
//       const formattedPhoneNumber = phoneNumber.startsWith('+') 
//         ? phoneNumber 
//         : `+${phoneNumber}`;

//       // Create a new client instance for each validation attempt
//       const validationClient = new TelegramClient(
//         this.session, 
//         apiId, 
//         apiHash, 
//         { connectionRetries: 5 }
//       );

//       // Connect client
//       await validationClient.connect();

//       // Attempt sign in
//       const signInResult = await validationClient.invoke(
//         new Api.auth.SignIn({
//           phoneNumber: formattedPhoneNumber,
//           phoneCodeHash: phoneCodeHash,
//           phoneCode: otp
//         })
//       );

//       // Generate a secure session token
//       const sessionToken = crypto.randomBytes(32).toString('hex');
      
//       // Save session with token
//       const sessionString = validationClient.session.save();
//       sessionStore.set(sessionToken, {
//         session: sessionString,
//         client: validationClient
//       });

//       // Additional validation checks
//       if (!signInResult) {
//         throw new Error('Authentication failed');
//       }

//       return {
//         status: 'success',
//         sessionToken: sessionToken,
//         user: signInResult.user ? {
//           id: signInResult.user.id,
//           firstName: signInResult.user.firstName,
//           lastName: signInResult.user.lastName
//         } : null
//       };

//     } catch (error) {
//       console.error("OTP Validation Detailed Error:", error);

//       // Differentiate between different types of errors
//       if (error.message.includes('PHONE_CODE_INVALID')) {
//         throw new Error('Invalid OTP code. Please try again.');
//       } else if (error.message.includes('PHONE_CODE_EXPIRED')) {
//         throw new Error('OTP has expired. Please request a new code.');
//       }

//       throw error;
//     }
//   }

//   // Method to get authenticated client
//   async getAuthenticatedClient(sessionToken) {
//     const sessionData = sessionStore.get(sessionToken);
//     if (!sessionData) {
//       throw new Error('Invalid session');
//     }

//     // Recreate client from saved session
//     const client = new TelegramClient(
//       new StringSession(sessionData.session), 
//       apiId, 
//       apiHash
//     );

//     await client.connect();
//     return client;
//   }
// }

// const app = express();
// app.use(cors());
// app.use(bodyParser.json());

// // Logging middleware
// app.use((req, res, next) => {
//   console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
//   console.log('Request Body:', req.body);
//   next();
// });

// const telegramAuthService = new TelegramAuthService();

// // Middleware to validate session
// const validateSession = async (req, res, next) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader) {
//     return res.status(401).json({ message: 'No authorization token provided' });
//   }

//   const sessionToken = authHeader.split(' ')[1];
//   try {
//     // Get authenticated client
//     req.telegramClient = await telegramAuthService.getAuthenticatedClient(sessionToken);
//     next();
//   } catch (error) {
//     res.status(401).json({ message: 'Invalid or expired session', error: error.message });
//   }
// };

// // Send OTP endpoint
// app.post('/send-otp', async (req, res) => {
//   try {
//     const { phoneNumber } = req.body;

//     if (!phoneNumber) {
//       return res.status(400).json({ 
//         status: 'error', 
//         message: 'Phone number is required' 
//       });
//     }

//     const result = await telegramAuthService.initializeClient(phoneNumber);

//     res.json({ 
//       status: 'success', 
//       message: 'OTP sent successfully',
//       phoneCodeHash: result.phoneCodeHash
//     });

//   } catch (error) {
//     console.error("Send OTP Error:", error);
//     res.status(500).json({ 
//       status: 'error', 
//       message: error.message || 'Failed to send OTP'
//     });
//   }
// });

// // Validate OTP endpoint
// app.post('/validate-otp', async (req, res) => {
//   try {
//     const { phoneNumber, otp, phoneCodeHash } = req.body;

//     if (!phoneNumber || !otp || !phoneCodeHash) {
//       return res.status(400).json({ 
//         status: 'error', 
//         message: 'Missing required parameters' 
//       });
//     }

//     const result = await telegramAuthService.validateOTP(
//       phoneNumber, 
//       otp, 
//       phoneCodeHash
//     );

//     res.json({ 
//       status: 'success', 
//       message: 'OTP validated successfully',
//       sessionToken: result.sessionToken,
//       user: result.user
//     });

//   } catch (error) {
//     console.error("Validate OTP Error:", error);
//     res.status(400).json({ 
//       status: 'error', 
//       message: error.message || 'Invalid OTP'
//     });
//   }
// });

// // Fetch chats endpoint
// app.get('/chats', validateSession, async (req, res) => {
//   try {
//     const client = req.telegramClient;
    
//     // Get dialogs (chats)
//     const dialogs = await client.getDialogs();
    
//     // Map dialogs to simplified chat objects
//     const chats = dialogs.map((dialog) => ({
//       id: dialog.id.toString(),
//       name: dialog.title || (dialog.name || "Unnamed Chat"),
//       type: dialog.isChannel ? "channel" : 
//              dialog.isGroup ? "group" : 
//              dialog.isUser ? "user" : "unknown"
//     }));

//     res.status(200).json(chats);
//   } catch (error) {
//     console.error("Error fetching chats:", error);
//     res.status(500).json({ 
//       message: "Error fetching chats", 
//       error: error.message 
//     });
//   }
// });

// // Fetch messages from a specific chat
// app.get('/chats/:id/messages', validateSession, async (req, res) => {
//   const chatId = req.params.id;

//   try {
//     const client = req.telegramClient;
    
//     // Get chat entity
//     const peer = await client.getEntity(chatId);
    
//     // Fetch messages (limit to 50 for performance)
//     const messages = await client.getMessages(peer, { limit: 50 });
    
//     // Format messages
//     const formattedMessages = messages.map((msg) => ({
//       id: msg.id,
//       message: msg.message || "[Media/Non-Text Message]",
//       date: msg.date,
//       sender: msg.senderId ? msg.senderId.toString() : "Unknown",
//       mediaType: msg.media ? msg.media.className : "text"
//     }));

//     res.status(200).json(formattedMessages);
//   } catch (error) {
//     console.error("Error Fetching Messages:", error);
//     res.status(500).json({ 
//       message: "Error fetching messages", 
//       error: error.message 
//     });
//   }
// });


// app.use((err, req, res, next) => {
//   console.error("Unhandled Server Error:", err);
//   res.status(500).json({
//     status: 'error',
//     message: 'Internal server error',
//     details: process.env.NODE_ENV === 'development' ? err.message : undefined
//   });
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });




// const express = require('express');
// const { TelegramClient } = require('telegram');
// const { StringSession } = require('telegram/sessions');
// const { Api } = require('telegram');
// const fs = require('fs');
// const path = require('path');
// const cors = require('cors');

// const app = express();
// const apiId = 22195259;
// const apiHash = '01b3e6454d012c1cd697fb99951e251e';
// const stringSession = new StringSession('');
// const client = new TelegramClient(stringSession, apiId, apiHash, {
//   connectionRetries: 5,
// });

// app.use(cors());

// // Track login status
// let isLoggedIn = false;
// let loginError = null;

// app.get('/generate-qr', async (req, res) => {
//   try {
//     await client.connect();
//     isLoggedIn = false;
//     loginError = null;

//     await client.signInUserWithQrCode(
//       { apiId, apiHash },
//       {
//         phoneNumber: async () => '',
//         password: async () => undefined,
//         phoneCode: async () => undefined,
//         onError: (err) => {
//           console.log('Login error:', err);
//           loginError = err.message;
//           return true;
//         },
//         qrCode: async (qrCode) => {
//           const loginLink = `tg://login?token=${qrCode.token.toString('base64url')}`;
          
//           // Save token for debugging (optional)
//           const filePath = path.join(__dirname, 'qrCodeTokens.txt');
//           const tokenData = `QR Code Token: ${qrCode.token.toString('base64url')}\nLogin URL: ${loginLink}\n`;
//           fs.appendFile(filePath, tokenData, (err) => {
//             if (err) console.error('Error saving QR code token to file:', err);
//           });

//           res.json({ loginLink });
//         },
//       }
//     );

//     // Set login status to true after successful QR code generation
//     isLoggedIn = true;
//   } catch (err) {
//     console.error('Error during QR generation:', err);
//     loginError = err.message;
//     res.status(500).json({ error: 'Failed to generate QR code' });
//   }
// });

// app.get('/check-session', async (req, res) => {
//   try {
//     const isAuthorized = await client.isUserAuthorized();
//     res.json({ 
//       isActive: isAuthorized,
//       error: loginError 
//     });
//   } catch (err) {
//     console.error('Error checking session:', err);
//     res.status(500).json({ 
//       isActive: false, 
//       error: 'Failed to check session status' 
//     });
//   }
// });

// app.get('/fetch-chats', async (req, res) => {
//   try {
//     const isAuthorized = await client.isUserAuthorized();
//     if (!isAuthorized) {
//       return res.status(401).json({ error: 'User not logged in' });
//     }

//     const dialogs = await client.getDialogs();
//     const chatList = dialogs.map(dialog => ({
//       id: dialog.id,
//       name: dialog.title || dialog.username || 'Unnamed Chat',
//       type: dialog.isGroup ? 'Group' : 'Private',
//       lastMessage: dialog.message ? {
//         text: dialog.message.text,
//         date: dialog.message.date
//       } : null
//     }));

//     res.json({ chats: chatList });
//   } catch (err) {
//     console.error('Error fetching chats:', err);
//     res.status(500).json({ error: 'Failed to fetch chats' });
//   }
// });

// app.listen(3001, () => {
//   console.log('Backend running on port 3001');
// });




// // Fetch chats endpoint
// app.get('/chats', validateSession, async (req, res) => {
//   try {
//     const client = req.telegramClient;
//     const dialogs = await client.getDialogs();
    
//     const chats = dialogs.map((dialog) => ({
//       id: dialog.id.toString(),
//       name: dialog.title || (dialog.name || "Unnamed Chat"),
//       type: dialog.isChannel ? "channel" : dialog.isGroup ? "group" : "user"
//     }));

//     res.json(chats);
//   } catch (error) {
//     res.status(500).json({
//       message: "Error fetching chats",
//       error: error.message
//     });
//   }
// });

// // Fetch messages endpoint
// app.get('/chats/:id/messages', validateSession, async (req, res) => {
//   const chatId = req.params.id;

//   try {
//     const client = req.telegramClient;
//     const peer = await client.getEntity(chatId);
//     const messages = await client.getMessages(peer, { limit: 50 });

//     const formattedMessages = messages.map((msg) => ({
//       id: msg.id,
//       message: msg.message || "[Media/Non-Text Message]",
//       date: msg.date,
//       sender: msg.senderId ? msg.senderId.toString() : "Unknown",
//       mediaType: msg.media ? msg.media.className : "text"
//     }));

//     res.json(formattedMessages);
//   } catch (error) {
//     res.status(500).json({
//       message: "Error fetching messages",
//       error: error.message
//     });
//   }
// });

// app.use((err, req, res, next) => {
//   console.error('Unhandled error:', err);
//   res.status(500).json({
//     error: 'Internal server error',
//     message: err.message,
//     details: process.env.NODE_ENV === 'development' ? err.stack : undefined
//   });
// });




const express = require("express");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Api } = require("telegram/tl");
const cors = require("cors");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const input = require("input"); 



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

  async initializeClient(phoneNumber) {
    try {
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        throw new Error('Invalid phone number format');
      }

      const formattedPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

      this.client = new TelegramClient(this.session, apiId, apiHash, {
        connectionRetries: 5,
        useWSS: false
      });

      await this.client.connect();

      const sendCodeResult = await this.client.invoke(
        new Api.auth.SendCode({
          phoneNumber: formattedPhoneNumber,
          apiId: apiId,
          apiHash: apiHash,
          settings: new Api.CodeSettings({})
        })
      );

      this.phoneCodeHash = sendCodeResult.phoneCodeHash;
      return { status: 'success', phoneCodeHash: this.phoneCodeHash };
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


  async validateOTP(phoneNumber, otp, phoneCodeHash) {
    try {
      if (!phoneNumber || !otp || !phoneCodeHash) {
        throw new Error('Missing required authentication parameters');
      }

      const formattedPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

      const validationClient = new TelegramClient(this.session, apiId, apiHash, {
        connectionRetries: 5
      });

      await validationClient.connect();

      const signInResult = await validationClient.invoke(
        new Api.auth.SignIn({
          phoneNumber: formattedPhoneNumber,
          phoneCodeHash: phoneCodeHash,
          phoneCode: otp
        })
      );

      const sessionToken = crypto.randomBytes(32).toString('hex');
      
      sessionStore.set(sessionToken, {
        session: validationClient.session.save(),
        client: validationClient
      });

      return {
        status: 'success',
        sessionToken: sessionToken,
        user: signInResult.user ? {
          id: signInResult.user.id,
          firstName: signInResult.user.firstName,
          lastName: signInResult.user.lastName
        } : null
      };
    } catch (error) {
      console.error("OTP Validation Error:", error);
      throw error;
    }
  }




  async getAuthenticatedClient(sessionToken) {
    try {
      console.log("Getting authenticated client for session:", sessionToken);
      const sessionData = sessionStore.get(sessionToken);
      
      if (!sessionData) {
        console.log("No session data found for token:", sessionToken);
        throw new Error('Invalid session');
      }

      const client = new TelegramClient(
        new StringSession(sessionData.session),
        apiId,
        apiHash,
        {
          connectionRetries: 5,
          useWSS: false
        }
      );

      await client.connect();
      return client;
    } catch (error) {
      console.error("Error getting authenticated client:", error);
      throw error;
    }
  }

  

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

// Send OTP endpoint
app.post('/send-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const result = await telegramAuthService.initializeClient(phoneNumber);
    res.json({
      status: 'success',
      message: 'OTP sent successfully',
      phoneCodeHash: result.phoneCodeHash
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to send OTP'
    });
  }
});

// Validate OTP endpoint
app.post('/validate-otp', async (req, res) => {
  try {
    const { phoneNumber, otp, phoneCodeHash } = req.body;
    const result = await telegramAuthService.validateOTP(phoneNumber, otp, phoneCodeHash);
    res.json({
      status: 'success',
      message: 'OTP validated successfully',
      sessionToken: result.sessionToken,
      user: result.user
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message || 'Invalid OTP'
    });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});







