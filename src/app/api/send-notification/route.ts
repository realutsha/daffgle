import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    success: true,
    message: "Notification API disabled for launch",
  });
}