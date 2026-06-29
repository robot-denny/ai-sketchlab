using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.Notifications;
using UmbracoProject.Features.Infrastructure;

namespace UmbracoProject.Features.Composer;

public class AssignMembersToPremiumRoleComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
        => builder.AddNotificationHandler<MemberSavedNotification,
            AssignMembersToPremiumRoleHandler>();
}
