import { PageFooter } from './Donut.jsx'
import { OPERATIONS_ROBOTS, robotHttpUrl, robotStatus } from './operationsRobots.js'

function RobotAction({ href, children }) {
  if (href) return <a className="btn btn-primary btn-sm" href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  return <button type="button" className="btn btn-ghost btn-sm" disabled>{children}</button>
}

export default function OperationsPage({ robots = OPERATIONS_ROBOTS }) {
  return (
    <div className="wrap">
      <div className="robot-grid">
        {robots.map((robot) => (
          <article className="card robot-card" key={robot.name}>
            <div className="card-body">
              <h2>{robot.name}</h2>
              <p className="robot-status"><span className="chip na">{robotStatus(robot)}</span></p>
              <div className="row-actions">
                <RobotAction href={robotHttpUrl(robot.watchUrl)}>Watch</RobotAction>
                <RobotAction href={robotHttpUrl(robot.startAction)}>Start</RobotAction>
              </div>
            </div>
          </article>
        ))}
      </div>
      <PageFooter />
    </div>
  )
}
