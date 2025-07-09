import WSocket from '#services/socket'
import app from '@adonisjs/core/services/app'
import { Socket } from 'socket.io'
import { SendMessageData, UserInQueue } from '#start/types'
import { disconnectUser, makeMatch } from './utils.js'

const userQueue: UserInQueue[] = []
const videoQueue: UserInQueue[] = []
const partnerMap = new Map<string, Socket>()
let temp: { socketId: string; chatType: string } = {
  socketId: '',
  chatType: '',
}

app.ready(() => {
  WSocket.boot()
  const io = WSocket.io

  io?.on('connection', (socket: Socket) => {
    socket.emit('send-user-id', { userId: socket.id, isQueueing: true })

    // User Matching
    socket.on('find-partner', (data: { peerId: string; chatType: string }) => {
      temp.chatType = data.chatType
      temp.socketId = socket.id

      if (data.chatType === 'text') {
        if (userQueue.length > 0) {
          const partner = userQueue.shift()

          makeMatch(socket, partner, data, partnerMap)
        } else {
          // if queue is empty, push the current socket matching
          userQueue.push({ socket, peerId: data.peerId })
        }
      } else {
        if (videoQueue.length > 0) {
          const partner = videoQueue.shift()

          console.log('Partners: ', socket.id, partner?.socket.id)
          makeMatch(socket, partner, data, partnerMap)
        } else {
          // if queue is empty, push the current socket matching
          videoQueue.push({ socket, peerId: data.peerId })
        }
      }
    })

    // Listen for chats from the client
    socket.on('send-message', async (data: SendMessageData) => {
      const timeout = 100

      try {
        await new Promise((res) => setTimeout(res, timeout))

        io.to(data.roomId!).emit('ping', { userId: data.userId, message: data.message })
      } catch (err) {
        console.log('Error: ', err)
      }
    })

    // Listen for typing events from the client
    socket.on('fire-typing', (data: { userId: string; roomId: string; isTyping: boolean }) => {
      socket.to(data.roomId).emit('fire-typing', { userId: data.userId, isTyping: data.isTyping })
    })

    // FOR REMOVAL (DON'T MIND THIS HEHE)
    // KINDA SUS
    socket.on('fire-disconnection', (socketId: string, chatType: string) => {
      disconnectUser(socket, partnerMap)

      if (chatType === 'video') {
        const index = videoQueue.findIndex((user) => user.socket.id === socketId)
        console.log(index)
        videoQueue.splice(index, 1)
      } else if (chatType === 'text') {
        const index = userQueue.findIndex((user) => user.socket.id === socketId)
        console.log(index)
        userQueue.slice(index, 1)
      }
    })

    // Listen for client disconnection
    socket.on('disconnect', () => {
      if (temp.chatType === 'video') {
        const index = videoQueue.findIndex((user) => user.socket.id === temp.socketId)
        console.log(index)
        videoQueue.splice(index, 1)
        console.log(videoQueue)
      } else if (temp.chatType === 'text') {
        const index = userQueue.findIndex((user) => user.socket.id === temp.socketId)
        console.log(index)
        userQueue.slice(index, 1)
        console.log(userQueue)
      }

      disconnectUser(socket, partnerMap)
      socket.emit('fire-disconnection', {})
    })
  })
})
