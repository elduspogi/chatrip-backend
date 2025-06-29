import WSocket from '#services/socket'
import app from '@adonisjs/core/services/app'
import { Socket } from 'socket.io'
import { SendMessageData } from '#start/types'

app.ready(() => {
  WSocket.boot()
  const io = WSocket.io

  io?.on('connection', (socket: Socket) => {
    console.log('User connected with ID: ', socket.id)

    socket.emit('send-user-id', { userId: socket.id })

    socket.on('send-message', async (data: SendMessageData) => {
      console.log('Event received: ', data)

      const timeout = 100

      try {
        await new Promise((res) => setTimeout(res, timeout))
        io.emit('ping', { userId: data.userId, message: data.message })
      } catch (err) {
        console.log('Error: ', err)
      }
    })
  })
})
