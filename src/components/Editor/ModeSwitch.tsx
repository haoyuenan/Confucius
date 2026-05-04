import { useEditorStore } from '../../stores/editor-store'
import styles from './ModeSwitch.module.css'

function ModeSwitch() {
  const mode = useEditorStore((s) => s.mode)
  const toggleMode = useEditorStore((s) => s.toggleMode)

  const config: Record<string, { icon: string; title: string }> = {
    split: { icon: '🎨 渲染', title: '切换到即时渲染模式' },
    wysiwyg: { icon: '📖 预览', title: '切换到预览模式' },
    preview: { icon: '✏️ 编辑', title: '切换到双栏编辑模式' },
  }

  const { icon, title } = config[mode] ?? config.split

  return (
    <button className={styles.modeSwitch} onClick={toggleMode} title={title}>
      {icon}
    </button>
  )
}

export default ModeSwitch
