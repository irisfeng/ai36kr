import SubmitForm from '@/components/SubmitForm';

export const metadata = { title: '投稿 - AI氪' };

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
