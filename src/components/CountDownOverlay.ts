/**
 * Created by rafaela on 04/09/25.
 */
// 2. COMPONENTE DE COUNTDOWN para usar no GameArena
const CountdownOverlay = ({ countdownTime, onComplete }: {
    countdownTime: number;
    onComplete?: () => void;
}) => {
    useEffect(() => {
        if (countdownTime <= 0 && onComplete) {
            onComplete();
        }
    }, [countdownTime, onComplete]);

    if (countdownTime <= 0) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <BarnCard variant="golden" className="text-center p-12">
    <div className="text-8xl mb-6 animate-pulse">
    {countdownTime}
    </div>
    <h2 className="text-3xl font-bold text-white mb-4">
    Prepare-se!
    </h2>
    <p className="text-white/80 text-lg">
        A música começará em instantes...
    </p>
    <div className="mt-6 flex justify-center">
    <div className="w-20 h-20 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
        </div>
        </BarnCard>
        </div>
    );
};