import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { to, message } = await request.json()
    
    if (!to || !message) {
      return NextResponse.json({ error: "Phone number and message are required" }, { status: 400 })
    }
    
    const apiKey = process.env.SSLWIRELESS_API_KEY
    const senderId = process.env.SSLWIRELESS_SENDER_ID || "8809601000400"
    
    if (!apiKey) {
      console.warn("SSLWIRELESS_API_KEY is missing. Running in demo mode.")
      return NextResponse.json({ success: true, demo: true, message: "Demo mode: SMS would be sent" })
    }
    
    // SslWireless API Endpoint (v3)
    const response = await fetch("https://api.sslwireless.com/v3/send-sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api_key": apiKey
      },
      body: JSON.stringify({
        messages: [{ to: to, text: message }],
        sender_id: senderId
      })
    })
    
    const result = await response.json()
    return NextResponse.json({ success: true, result })
    
  } catch (error) {
    console.error("SMS API Error:", error)
    return NextResponse.json({ error: "Failed to send SMS" }, { status: 500 })
  }
}