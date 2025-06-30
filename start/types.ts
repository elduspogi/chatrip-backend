import EventEmitter from 'node:events'

export interface SendMessageData {
  userId?: string
  roomId: string
  message?: string
}

export const emitter = new EventEmitter()
