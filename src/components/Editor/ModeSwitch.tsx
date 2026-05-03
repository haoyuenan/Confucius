import { useEditorStore } from '../../stores/editor-store'

function ModeSwitch() {
  const mode = useEditorStore((s) => s.mode)
  const toggleMode = useEditorStore((s) => s.toggleMode)

  return (
    <button
      className="mode-switch"
      onClick={toggleMode}
      title={mode === 'split' ? '切换到即时渲染模式' : '切换到双栏模式'}
    >
      {mode === 'split' ? '🎨 渲染' : '📝 源码'}
    </button>
  )
}

export default ModeSwitch
