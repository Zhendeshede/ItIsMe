import { RouteObject } from 'react-router-dom'
import Earth from '@/pages/Earth'
import Galaxy from '@/pages/Galaxy'


export const routes: RouteObject[] = [
  { path: '/galaxy', element: <Galaxy /> },
  { path: '/earth', element: <Earth /> },
]