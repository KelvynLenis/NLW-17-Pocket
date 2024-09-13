import dayjs from 'dayjs'
import { db } from '../db'
import { goalCompletions, goals } from '../db/schema'
import { and, count, eq, gte, lte, sql } from 'drizzle-orm'

export async function getWeekPendingGoals() {
  const fistDayOfWeek = dayjs().startOf('week').toDate()
  const lastDayOfWeek = dayjs().endOf('week').toDate()

  const goalsCreatedUptoWeek = db.$with('goals_created_up_to_week').as(
    db
      .select({
        id: goals.id,
        title: goals.title,
        desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
        createAt: goals.createAt,
      })
      .from(goals)
      .where(lte(goals.createAt, lastDayOfWeek))
  )

  const goalsCompletionCounts = db.$with('goals_completion_counts').as(
    db
      .select({
        goalId: goalCompletions.goalId,
        completionCount: count(goalCompletions.id).as('completionCount'),
      })
      .from(goalCompletions)
      .where(
        and(
          gte(goalCompletions.createAt, fistDayOfWeek),
          lte(goalCompletions.createAt, lastDayOfWeek)
        )
      )
      .groupBy(goalCompletions.goalId)
  )

  const pendingGoals = await db
    .with(goalsCreatedUptoWeek, goalsCompletionCounts)
    .select({
      id: goalsCreatedUptoWeek.id,
      title: goalsCreatedUptoWeek.title,
      desiredWeeklyFrequency: goalsCreatedUptoWeek.desiredWeeklyFrequency,
      completionCount: sql /*sql*/`
        coalesce(${goalsCompletionCounts.completionCount}, 0)
      `.mapWith(Number),
    })
    .from(goalsCreatedUptoWeek)
    .leftJoin(
      goalsCompletionCounts,
      eq(goalsCompletionCounts.goalId, goalsCreatedUptoWeek.id)
    )

  return {
    pendingGoals,
  }
}
