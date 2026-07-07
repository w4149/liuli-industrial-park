import { Component } from 'react'
import './app.scss'

class App extends Component {
  componentDidMount() {}

  componentWillUnmount() {}

  render() {
    return this.props.children
  }
}

export default App
