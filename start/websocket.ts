import WSocket from '#services/socket'
import app from '@adonisjs/core/services/app'
import { Socket } from 'socket.io'
import { SendMessageData } from '#start/types'
import { randomUUID } from 'node:crypto'

const userQueue: Socket[] = []
const partnerMap = new Map<string, Socket>()

app.ready(() => {
  WSocket.boot()
  const io = WSocket.io

  io?.on('connection', (socket: Socket) => {
    console.log('User connected with ID: ', socket.id)

    socket.emit('send-user-id', { userId: socket.id, isQueueing: true })

    socket.on('find-partner', () => {
      console.log(`${socket.id} is looking for a partner.`)

      if (userQueue.length > 0) {
        // Get the first user in queue and remove from the queue
        const partner = userQueue.shift()

        if (partner?.connected) {
          const roomId = randomUUID()

          partnerMap.set(socket.id, partner)
          partnerMap.set(partner.id, socket)

          socket.join(roomId)
          partner.join(roomId)

          socket.emit('matched', { roomId: roomId, partnerId: partner.id, isQueueing: false })
          partner.emit('matched', { roomId: roomId, partnerId: socket.id, isQueueing: false })

          console.log(`Matched ${socket.id} and ${partner.id} in room ${roomId}`)
        } else {
          userQueue.push(socket)
        }
      } else {
        userQueue.push(socket)
        console.log(`${socket.id} added to queue.`)
      }
    })

    socket.on('send-message', async (data: SendMessageData) => {
      console.log('Event received: ', data)

      const timeout = 100

      try {
        await new Promise((res) => setTimeout(res, timeout))

        io.to(data.roomId!).emit('ping', { userId: data.userId, message: data.message })
      } catch (err) {
        console.log('Error: ', err)
      }
    })

    socket.on('fire-typing', (data: { userId: string; roomId: string; isTyping: boolean }) => {
      console.log(data.userId, data.roomId, data.isTyping)
      socket.to(data.roomId).emit('fire-typing', { userId: data.userId, isTyping: data.isTyping })
    })

    socket.on('fire-disconnection', (data: { userId: string; roomId: string }) => {
      const partner = partnerMap.get(socket.id)

      if (partner) {
        socket.leave(data.roomId)
        partner.leave(data.roomId)

        socket.emit('notify-disconnection', { userId: data.userId, isDisconnected: true })
        partner.emit('notify-disconnection', { userId: data.userId, isDisconnected: true })

        partnerMap.delete(socket.id)
        partnerMap.delete(partner.id)
      }
    })
  })
})
