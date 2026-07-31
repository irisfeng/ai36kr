import SubmitForm from '@/components/SubmitForm';

// 无缓存指令的纯静态页会在构建期预渲染，把空库的脉搏条永久钉进 HTML → 动态渲染
export const dynamic = 'force-dynamic';

export const metadata = { title: '投稿 - 听潮' };

export default function SubmitPage() {
  return (
    <div className="container">
      <div className="submit-wrap">
        <div className="page-head" style={{ paddingTop: 8 }}>
          <h1>投稿</h1>
          <p>看到值得讨论的 AI 动态？分享给社区。提交后直接进入最新列表。</p>
        </div>
        <SubmitForm />
      </div>
    </div>
  );
}
