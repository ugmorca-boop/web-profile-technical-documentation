import { describe, it, expect } from 'vitest'
import { canSignIn, isInactive } from '../src/lib/membership'
import { canTransition } from '../src/lib/workflow'

const now = new Date('2026-01-10T00:00:00Z')
describe('canSignIn', () => {
  it('allows active member in term', () => expect(canSignIn({ status: 'active', termEndsAt: '2026-06-01' }, now)).toBe(true))
  it('blocks suspended', () => expect(canSignIn({ status: 'suspended' }, now)).toBe(false))
  it('blocks alumni', () => expect(canSignIn({ status: 'alumni' }, now)).toBe(false))
  it('blocks expired term', () => expect(canSignIn({ status: 'active', termEndsAt: '2025-12-31' }, now)).toBe(false))
})
describe('isInactive', () => {
  it('flags never-active', () => expect(isInactive(null, now)).toBe(true))
  it('flags 91 days', () => expect(isInactive('2025-10-10T00:00:00Z', now)).toBe(true))
  it('accepts recent', () => expect(isInactive('2026-01-01T00:00:00Z', now)).toBe(false))
})
describe('canTransition', () => {
  it('member submits own draft', () => expect(canTransition({ role: 'member', from: 'draft', to: 'submitted', isAuthor: true })).toBe(true))
  it('member cannot publish', () => expect(canTransition({ role: 'member', from: 'submitted', to: 'published', isAuthor: true })).toBe(false))
  it('member cannot submit others draft', () => expect(canTransition({ role: 'member', from: 'draft', to: 'submitted', isAuthor: false })).toBe(false))
  it('editor approves others', () => expect(canTransition({ role: 'editor', from: 'submitted', to: 'approved', isAuthor: false })).toBe(true))
  it('editor cannot approve own', () => expect(canTransition({ role: 'editor', from: 'submitted', to: 'approved', isAuthor: true })).toBe(false))
  it('admin cannot approve own', () => expect(canTransition({ role: 'admin', from: 'submitted', to: 'approved', isAuthor: true })).toBe(false))
  it('cannot skip review', () => expect(canTransition({ role: 'editor', from: 'draft', to: 'published', isAuthor: false })).toBe(false))
})
