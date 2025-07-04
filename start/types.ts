import EventEmitter from 'node:events'
import { Socket } from 'socket.io'

export interface SendMessageData {
  userId: string
  roomId: string
  message: string
}

// Kinda sus, might delete later
export type User = {
  id: Socket
  interests: string[]
}

export type UserInQueue = {
  socket: Socket
  peerId: string
}

export const emitter = new EventEmitter()
