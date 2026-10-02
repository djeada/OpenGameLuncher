export type UpdateFailure = {
  message: string
  // The update exists but this copy cannot install it, so the player downloads it instead.
  manual: boolean
}

// Turns what the updater reports into a sentence a player can act on.
export function describeUpdateError(raw: string): UpdateFailure {
  const text = raw.toLowerCase()
  if (text.includes('code signature') || text.includes('code requirement') || text.includes('not signed')) {
    return { message: 'This copy of OGL cannot install updates by itself. Download the new version instead.', manual: true }
  }
  if (
    text.includes('err_internet_disconnected') ||
    text.includes('err_name_not_resolved') ||
    text.includes('err_network') ||
    text.includes('err_connection') ||
    text.includes('enotfound') ||
    text.includes('etimedout') ||
    text.includes('econnre')
  ) {
    return { message: 'Could not reach GitHub. Check your internet connection and try again.', manual: false }
  }
  if (text.includes('rate limit') || text.includes(' 403')) {
    return { message: 'GitHub is limiting requests right now. Try again in a few minutes.', manual: false }
  }
  if (text.includes('sha512') || text.includes('checksum')) {
    return { message: 'The download was incomplete. Try again.', manual: false }
  }
  return { message: 'The update did not work. Try again, or download the new version.', manual: true }
}
