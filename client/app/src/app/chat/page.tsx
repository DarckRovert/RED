"use client";

import React from "react";
import Sidebar from "../../components/Sidebar";
import ChatWindow from "../../components/ChatWindow";

export default function ChatPage() {
  return (
    <main className="app-container">
      <Sidebar />
      <ChatWindow />
    </main>
  );
}
