import WSocket from '#services/socket'
import app from '@adonisjs/core/services/app'
import { Socket } from 'socket.io'
import { SendMessageData, UserInQueue } from '#start/types'
import { disconnectUser, makeMatch } from './utils.js'

const userQueue: UserInQueue[] = []
const videoQueue: UserInQueue[] = []
const partnerMap = new Map<string, Socket>()
let chatType: string

app.ready(() => {
  WSocket.boot()
  const io = WSocket.io

  io?.on('connection', (socket: Socket) => {
    socket.emit('send-user-id', { userId: socket.id, isQueueing: true })

    // User Matching
    socket.on('find-partner', (data: { peerId: string; chatType: string }) => {
      chatType = data.chatType
      console.log(chatType)

      if (data.chatType === 'text') {
        if (userQueue.length >= 1) {
          const partner = userQueue.pop()

          makeMatch(socket, partner, data, partnerMap)
        } else {
          // if queue is empty, push the current socket matching
          userQueue.push({ socket, peerId: data.peerId })
          console.log(userQueue.map((user) => user.socket.id))
        }
      } else {
        console.log('videoQueue length: ', videoQueue.length)

        if (videoQueue.length >= 1) {
          const partner = videoQueue.pop()

          makeMatch(socket, partner, data, partnerMap)
        } else {
          // if queue is empty, push the current socket matching
          videoQueue.push({ socket, peerId: data.peerId })
          console.log(videoQueue.map((user) => user.socket.id))
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
    socket.on('fire-disconnection', () => {
      disconnectUser(socket, partnerMap)
    })

    // Listen for client disconnection
    socket.on('disconnect', () => {
      disconnectUser(socket, partnerMap)
      socket.emit('fire-disconnection', {})
    })

    socket.on('stop-queueing', (data: { chatType: string }) => {
      if (data.chatType === 'video') {
        const index = videoQueue.findIndex((user) => user.socket.id === socket.id)
        console.log(index)
        console.log('videoQueue before: ', videoQueue)
        videoQueue.splice(index, 1)

        console.log(
          'videoQueue after: ',
          videoQueue.map((user) => user.socket.id)
        )
      } else if (data.chatType === 'text') {
        console.log('delete: ', socket.id)
        const index = userQueue.findIndex((user) => user.socket.id === socket.id)
        console.log(index)
        console.log('userQueue before: ', userQueue)
        userQueue.splice(index, 1)

        console.log('userQueue after: ', userQueue)
      }
    })
  })
})
