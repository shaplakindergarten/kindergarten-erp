import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { to, message } = await request.json()
    
    if (!to || !message) {
      return NextResponse.json({ error: "Phone number and message are required" }, { status: 400 })
    }
    
    const accessToken = process.env.META_WHATSAPP_TOKEN
    const phoneNumberId = process.env.META_PHONE_NUMBER_ID
    
    if (!accessToken || !phoneNumberId) {
      console.warn("Meta WhatsApp credentials missing. Running in demo mode.")
      return NextResponse.json({ success: true, demo: true, message: "Demo mode: WhatsApp would be sent" })
    }
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to,
          type: "text",
          text: { body: message }
        })
      }
    )
    
    const result = await response.json()
    return NextResponse.json({ success: true, result })
    
  } catch (error) {
    console.error("WhatsApp API Error:", error)
    return NextResponse.json({ error: "Failed to send WhatsApp message" }, { status: 500 })
  }
}